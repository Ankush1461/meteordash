import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import React, { useEffect, useRef } from "react";

type Props = {
  setHandResults: (result: any) => void;
  /** Increment to re-run camera/model initialization (e.g. from a retry button). */
  retryAttempt?: number;
};

const HandRecognizer = ({ setHandResults, retryAttempt = 0 }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    // Guards against the init racing with unmount (e.g. React StrictMode's
    // double-mount or a retry while a previous attempt is still pending).
    const init = { cancelled: false };
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    let lightInterval: ReturnType<typeof setInterval> | undefined;
    // Reported low-light state (sent to the engine only when it CHANGES, so
    // the 1 Hz brightness check never churns React state on unchanged frames).
    let lowLight = false;

    setHandResults({ isLoading: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (init.cancelled) {
          stopTracks(stream);
          return;
        }

        videoElement.srcObject = stream;
        const onLoaded = () => {
          if (!init.cancelled) {
            // Autoplay can be blocked until a user gesture; ignore that.
            videoElement.play().catch(() => {});
          }
        };
        videoElement.addEventListener("loadeddata", onLoaded, { once: true });

        const handLandmarker = await initModel();
        if (init.cancelled) {
          return;
        }

        interval = setInterval(() => {
          const detections = handLandmarker.detectForVideo(
            videoElement,
            Date.now()
          );
          processDetections(detections, setHandResults);
        }, 1000 / 30);

        // Room-lighting check: sample the average video brightness once a
        // second. Below LOW_LIGHT_THRESHOLD the room is too dark for MediaPipe
        // to track hands reliably; hysteresis (must climb above
        // LOW_LIGHT_RECOVER to clear) stops the warning from flickering
        // around the boundary. Only reported on state CHANGE.
        lightInterval = setInterval(() => {
          if (
            videoElement.videoWidth === 0 ||
            videoElement.readyState < 2 ||
            videoElement.paused
          ) {
            return; // no frames yet — skip until the feed is live
          }
          const avg = sampleVideoBrightness(videoElement);
          const next = lowLight
            ? avg < LOW_LIGHT_RECOVER
            : avg < LOW_LIGHT_THRESHOLD;
          if (next !== lowLight) {
            lowLight = next;
            setHandResults({ lowLight });
          }
        }, LIGHT_CHECK_MS);

        // Explicitly clear any prior camera error — without this, a
        // successful retry leaves the old error state on screen forever.
        setHandResults({ isLoading: false, cameraError: null, lowLight });
      } catch (err) {
        if (!init.cancelled) {
          setHandResults({
            isLoading: false,
            cameraError: cameraErrorMessage(err),
          });
        }
      }
    })();

    return () => {
      init.cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
      if (lightInterval) {
        clearInterval(lightInterval);
      }
      if (stream) {
        stopTracks(stream);
      }
      const attached = videoElement.srcObject as MediaStream | null;
      if (attached) {
        stopTracks(attached);
        videoElement.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only on retry; setHandResults is intentionally captured once
  }, [retryAttempt]);

  return (
    <div>
      <video
        className="scale-x-[-1] border-2 border-stone-800 rounded-lg"
        ref={videoRef}
      ></video>
    </div>
  );
};

export default HandRecognizer;

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function cameraErrorMessage(err: unknown): string {
  const name = (err as DOMException)?.name;
  switch (name) {
    case "NotAllowedError":
      return "Camera permission denied. Allow camera access in your browser and try again.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is in use by another application.";
    default:
      return "The camera could not be started. Check that it's connected and not in use.";
  }
}

// --- Low-light warning ----------------------------------------------------
// MediaPipe's hand landmarker needs contrast to track reliably; a dark room
// (average video brightness below LOW_LIGHT_THRESHOLD) makes gestures flaky.
// Hysteresis keeps the warning stable at the boundary.
const LIGHT_CHECK_MS = 1000; // sample the feed once per second
const LOW_LIGHT_THRESHOLD = 32; // avg brightness (0–255) below this = too dark
const LOW_LIGHT_RECOVER = 46; // must climb above this before the warning clears

/** Average luminance (0–255) of a small downscaled frame of the video. */
function sampleVideoBrightness(video: HTMLVideoElement): number {
  const w = 32;
  const h = 24;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 255; // cannot sample — don't nag the player
  ctx.drawImage(video, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return 255;
  }
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma — close enough for a room-brightness heuristic.
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / 4);
}

async function initModel() {
  const wasm = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  const handLandmarker = HandLandmarker.createFromOptions(wasm, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    numHands: 2,
    runningMode: "VIDEO",
  });
  return handLandmarker;
}

// Gesture classification thresholds. All distances are normalized by each
// hand's own size (wrist → middle-MCP), so they work at any camera distance.
const GESTURE = {
  // thumb-tip ↔ pinky-tip distance (open spread hand) relative to palm height
  spreadRatio: 1.3,
  // a flat open palm keeps the thumb tucked, so spread stays below this
  flatSpreadMax: 1.0,
  // fraction of the 4 fingers extended needed to call a hand "flat"
  flatOpenness: 0.75,
  // a flat palm also keeps the thumb away from the index — this separates it
  // from a pinch (which tucks the thumb onto the index finger)
  flatThumbMin: 0.65,
  // fraction of the 4 fingers extended below which a hand is a "fist"
  fistOpenness: 0.35,
  // a fist also keeps the thumb near the pinky
  fistSpreadMax: 0.9,
  // fingertip must be this much farther from the wrist than its MCP to count
  // as extended (curled fingertips pull back toward the palm)
  extendedRatio: 1.35,
  // thumb-tip ↔ index-tip distance relative to palm height: below this the
  // hand is pinching (the classic thumb-on-index "OK-ish" shape)
  pinchMax: 0.55,
  // A POINTING hand's pinch is measured against its own recent thumb rest
  // position (see pointPinch below): the thumb must swing to within this
  // fraction of its rolling baseline, or below pinchMax, to count. A
  // resting thumb pressed against the index can't trip it.
  pointPinchRatio: 0.72,
  // a pinch requires most of the OUTER fingers (middle/ring/pinky) extended,
  // so it can't be confused with a fist (all curled) or a fist-pause
  pinchOuterMin: 0.66,
  // a pointing hand extends the index and curls the outer fingers; a flat
  // palm fails this (outerOpenness 1.0), a fist fails it (index curled).
  // 0.45 (not 0.33) so a natural point — where the middle finger often
  // drifts half-up — keeps registering instead of flickering the cursor
  // off mid-motion. Flat/spread/fist poses all stay far above it.
  pointOuterMax: 0.45,
};

// Rolling baseline of each pointing hand's resting thumb↔index distance,
// keyed by HANDEDNESS label ("Right"/"Left"/"Any"), not the detections
// array index — MediaPipe reorders hands frame to frame, and an index-keyed
// baseline went stale after a reorder, making the next pinch impossible to
// trigger until it slowly re-adapted. The menu pinch is judged against this
// baseline (see pointPinch), so a thumb that naturally rests against the
// index while pointing never reads as a click — only a deliberate pinch
// (thumb swinging clearly closer) does.
const pointThumbBaseline = new Map<string, number>();

function gestureFeatures(landmarks: { x: number; y: number }[]) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const handSize =
    Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y) || 1e-6;

  // Spread: how far the thumb and pinky tips are apart, relative to the hand.
  const spread =
    Math.hypot(
      landmarks[4].x - landmarks[20].x,
      landmarks[4].y - landmarks[20].y
    ) / handSize;

  // Pinch: thumb-tip ↔ index-tip distance relative to the hand. A real pinch
  // brings them together; a fist keeps the thumb curled near the palm.
  const thumbIndex =
    Math.hypot(
      landmarks[4].x - landmarks[8].x,
      landmarks[4].y - landmarks[8].y
    ) / handSize;

  // Openness: what fraction of the 4 fingers are extended (not curled).
  const fingers: Array<[number, number]> = [
    [8, 5], // index tip / MCP
    [12, 9], // middle
    [16, 13], // ring
    [20, 17], // pinky
  ];
  let extended = 0;
  let outerExtended = 0;
  let indexExtended = false;
  for (let i = 0; i < fingers.length; i++) {
    const [tip, mcp] = fingers[i];
    const tipDist = Math.hypot(
      landmarks[tip].x - wrist.x,
      landmarks[tip].y - wrist.y
    );
    const mcpDist = Math.hypot(
      landmarks[mcp].x - wrist.x,
      landmarks[mcp].y - wrist.y
    );
    if (tipDist > mcpDist * GESTURE.extendedRatio) {
      extended++;
      if (i === 0) {
        indexExtended = true;
      } else {
        outerExtended++; // middle, ring, pinky only
      }
    }
  }
  return {
    spread,
    thumbIndex,
    openness: extended / fingers.length,
    outerOpenness: outerExtended / 3,
    indexExtended,
  };
}

function processDetections(
  detections: HandLandmarkerResult,
  setHandResults: (result: any) => void
) {
  // Menu navigation uses a SINGLE pointing forefinger — no palm companion
  // required. One hand pointing is enough to drive the cursor on the
  // idle/pause/game-over screens. isDetected still means BOTH hands, so
  // pointing alone never starts a run.
  const hands = detections?.landmarks ?? [];
  const hasBoth = !!detections && detections.handedness.length > 1;
  let isPoint = false;
  let pointX = 0.5;
  let pointY = 0.5;
  // A pinch on the pointing hand is the menu "click".
  let pointPinch = false;
  if (hands.length >= 1) {
    const feats = hands.map(gestureFeatures);
    const isPointing = (i: number) =>
      feats[i].indexExtended &&
      feats[i].outerOpenness <= GESTURE.pointOuterMax;
    let pointIdx = feats.findIndex((_, i) => isPointing(i));
    if (pointIdx >= 0 && hasBoth) {
      // Both hands visible: prefer the RIGHT pointing hand so a mirrored
      // stray finger on the left can't hijack the cursor.
      const rightIdx =
        detections.handedness[0][0].categoryName === "Right" ? 0 : 1;
      if (isPointing(rightIdx)) pointIdx = rightIdx;
    }
    if (pointIdx >= 0) {
      isPoint = true;
      // Drive the cursor from the INDEX TIP (the finger you're pointing
      // with), not the palm — aiming at a button with your fingertip is
      // far more intuitive, and the engine's EMA smoothing absorbs the
      // tip's extra jitter.
      const tip = detections.landmarks[pointIdx][8];
      pointX = tip.x;
      pointY = tip.y;
      // The pointing hand curls its outer fingers, so its pinch uses the
      // plain thumb↔index distance (not the outer-openness rule) — the
      // classic "thumb on the extended index" click shape. To stop a
      // resting thumb (which often sits against the index) from clicking
      // by itself, the pinch is judged against this hand's rolling rest
      // baseline: the thumb must swing to within 72% of its recent resting
      // distance (or below pinchMax outright) to count as a deliberate
      // pinch.
      const handLabel =
        detections.handedness[pointIdx]?.[0]?.categoryName ?? "Any";
      const thumbIndex = feats[pointIdx].thumbIndex;
      let baseline = pointThumbBaseline.get(handLabel);
      if (baseline === undefined) {
        // A fresh hand: seed slightly above the current thumb so the very
        // first pinch registers without a multi-frame warm-up, then let
        // the EMA converge to the true resting position.
        baseline = Math.min(1, thumbIndex + 0.2);
        pointThumbBaseline.set(handLabel, baseline);
      } else if (thumbIndex >= GESTURE.pinchMax) {
        // Adapt ONLY while the thumb is at rest — never while pinching, or
        // the baseline ratchets down toward the pinched position and every
        // subsequent click gets progressively harder to trigger.
        baseline = baseline * 0.92 + thumbIndex * 0.08;
        pointThumbBaseline.set(handLabel, baseline);
      }
      pointPinch =
        thumbIndex < GESTURE.pinchMax &&
        thumbIndex < baseline * GESTURE.pointPinchRatio;
    }
  }

  if (hasBoth) {
    const rightIndex =
      detections.handedness[0][0].categoryName === "Right" ? 0 : 1;
    const leftIndex = rightIndex === 0 ? 1 : 0;

    const { x: leftX, y: leftY, z: leftZ } = detections.landmarks[leftIndex][6];
    const {
      x: rightX,
      y: rightY,
      z: rightZ,
    } = detections.landmarks[rightIndex][6];

    const tilt = (rightY - leftY) / (rightX - leftX);
    const degrees = (Math.atan(tilt) * 180) / Math.PI;

    // Per-frame gesture classification from raw landmarks. The hold/edge
    // detection (debounce, cooldowns) happens in setHandResults on the page.
    const feats = hands.map(gestureFeatures);
    const isSpread = feats.every((h) => h.spread > GESTURE.spreadRatio);
    // A flat palm keeps the thumb away from the index — the thumbIndex guard
    // stops a pinching hand (thumb tucked onto index) from reading as a shield.
    const isFlat = feats.every(
      (h) =>
        h.openness >= GESTURE.flatOpenness &&
        h.spread <= GESTURE.flatSpreadMax &&
        h.thumbIndex > GESTURE.flatThumbMin
    );
    // A fist curls EVERY finger; a pointing hand extends the index, so the
    // indexExtended guard stops a point pose from ever reading as a fist
    // (which would click buttons in the menus).
    const isFist = feats.every(
      (h) =>
        h.openness <= GESTURE.fistOpenness &&
        h.spread <= GESTURE.fistSpreadMax &&
        !h.indexExtended
    );
    // Pinch: thumb on index with the outer fingers still up ("OK-ish"
    // shape). ANY single hand pinching fires — the other hand can keep
    // flying/steering. Dash, shield and pause stay both-hands gestures.
    const isPinch = feats.some(
      (h) =>
        h.thumbIndex < GESTURE.pinchMax &&
        h.outerOpenness >= GESTURE.pinchOuterMin
    );

    setHandResults({
      isDetected: true,
      tilt,
      degrees,
      isSpread,
      isFlat,
      isFist,
      isPinch,
      isPoint,
      pointX,
      pointY,
      pointPinch,
    });
  } else {
    // A single visible hand: classify it too, so one-hand gestures work
    // (pinch to fire, flat palm shield, spread dash, fist pause) and the
    // engine doesn't pause the game while a lone hand is mid-gesture.
    // isDetected stays false — BOTH hands are still required for steering
    // and for starting a run.
    const single = hands[0] ? gestureFeatures(hands[0]) : null;
    const isSinglePinch =
      !!single &&
      single.thumbIndex < GESTURE.pinchMax &&
      single.outerOpenness >= GESTURE.pinchOuterMin;
    const isSingleFlat =
      !!single &&
      single.openness >= GESTURE.flatOpenness &&
      single.spread <= GESTURE.flatSpreadMax &&
      single.thumbIndex > GESTURE.flatThumbMin;
    const isSingleSpread = !!single && single.spread > GESTURE.spreadRatio;
    const isSingleFist =
      !!single &&
      single.openness <= GESTURE.fistOpenness &&
      single.spread <= GESTURE.fistSpreadMax &&
      !single.indexExtended;
    setHandResults({
      isDetected: false,
      tilt: 0,
      degrees: 0,
      isSpread: isSingleSpread,
      isFlat: isSingleFlat,
      isFist: isSingleFist,
      isPinch: isSinglePinch,
      isPoint,
      pointX,
      pointY,
      // A lone pointing hand can also pinch-click in the menus.
      pointPinch,
    });
  }
}
