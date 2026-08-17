import * as Tone from "tone";

let bgPlayer: Tone.Player | null = null;
let fxPlayer: Tone.Player | null = null;
let lowPass: Tone.Filter | null = null;
let useLowPass = false;

/**
 * Zone-tinted music beds: the same loop.m4a bed is re-routed through a
 * per-zone effect chain so each chapter has its own sonic character without
 * needing extra audio assets. The chain is rebuilt on zone change; menus
 * still drop the whole bed behind the low-pass muffling via `useLowPass`.
 */
interface ZoneTint {
  name: string;
  build: () => Tone.ToneAudioNode[];
}

const ZONE_TINTS: ZoneTint[] = [
  // 1 — Asteroid Belt: neutral, the raw loop.
  { name: "Asteroid Belt", build: () => [] },
  // 2 — Nebula: airy and washed-out — a band shimmer with slow tremolo.
  {
    name: "Nebula",
    build: () => [
      new Tone.Filter(700, "bandpass"),
      new Tone.Tremolo({ frequency: 0.35, depth: 0.3 }).start(),
    ],
  },
  // 3 — Ice Field: cold and muffled — dull low-pass with a faint icy shimmer.
  {
    name: "Ice Field",
    build: () => [
      new Tone.Filter(1500, "lowpass"),
      new Tone.Tremolo({ frequency: 0.6, depth: 0.18 }).start(),
    ],
  },
  // 4 — Lava Belt: hot and gritty — clipped highs over a low roar.
  {
    name: "Lava Belt",
    build: () => [
      new Tone.Filter(160, "highpass"),
      new Tone.Distortion(0.22),
      new Tone.Filter(650, "lowpass"),
    ],
  },
  // 5 — Void: hollow and dark — two narrow bands with nothing between.
  {
    name: "Void",
    build: () => [
      new Tone.Filter(240, "bandpass"),
      new Tone.Filter(2400, "bandpass"),
    ],
  },
];

let tintChain: Tone.ToneAudioNode[] = [];
let pendingTint = 0;

function routeBackground() {
  if (!bgPlayer) return;
  bgPlayer.disconnect();
  let prev: Tone.ToneAudioNode = bgPlayer;
  for (const node of tintChain) {
    prev.connect(node);
    prev = node;
  }
  if (useLowPass) {
    if (!lowPass) lowPass = new Tone.Filter(400, "lowpass");
    prev.connect(lowPass);
    prev = lowPass;
  }
  prev.toDestination();
}

/**
 * Retune the music bed for the given zone (1-based index into ZONE_THEMES).
 * Safe to call before audio has ever played — the tint is applied the moment
 * the background player first starts.
 */
export async function setZoneTint(zoneIndex: number) {
  const idx =
    ((zoneIndex - 1) % ZONE_TINTS.length + ZONE_TINTS.length) %
    ZONE_TINTS.length;
  pendingTint = idx;
  try {
    for (const node of tintChain) {
      node.dispose();
    }
    tintChain = [];
    if (!bgPlayer) return;
    tintChain = ZONE_TINTS[idx].build();
    routeBackground();
  } catch {
    // Audio is non-critical: never let a zone change crash the game.
  }
}

/**
 * Boss-intensity layer: a low sawtooth drone under a slow heartbeat swell.
 * No assets needed — synthesized, routed through the same destination so the
 * mute toggle and master volume apply to it like everything else.
 */
let droneOsc: Tone.Oscillator | null = null;
let droneGain: Tone.Gain | null = null;
let droneLfo: Tone.LFO | null = null;

export async function setBossIntensity(on: boolean) {
  try {
    if (!droneOsc) {
      const osc = new Tone.Oscillator({ frequency: 55, type: "sawtooth" });
      const filter = new Tone.Filter(150, "lowpass");
      const gain = new Tone.Gain(0.0001);
      const lfo = new Tone.LFO(0.5, 0, 0.1);
      osc.connect(filter);
      filter.connect(gain);
      gain.toDestination();
      lfo.connect(gain.gain);
      droneOsc = osc;
      droneGain = gain;
      droneLfo = lfo;
      lfo.start();
      osc.start();
    }
    const gain = droneGain!;
    if (on) {
      gain.gain.rampTo(0.16, 1.2);
    } else {
      gain.gain.rampTo(0.0001, 1.2);
    }
  } catch {
    // Audio is non-critical: never let an intensity change crash the game.
  }
}

/**
 * Must be called from a user gesture (click, key press) to satisfy the
 * browser's autoplay policy — until then the AudioContext stays suspended
 * and no sound plays, no matter when players are started.
 */
export async function unlockAudio() {
  try {
    await Tone.start();
  } catch {
    // Ignore: some browsers still refuse without a real gesture.
  }
}

/** Mutes/unmutes everything through the destination node. */
export async function setMuted(muted: boolean) {
  try {
    Tone.getDestination().mute = muted;
  } catch {
    // Audio is non-critical.
  }
}

/**
 * Master volume as a 0–1 fraction (0.5 = 50%). Mapped to decibels on Tone's
 * destination (20·log10), so the slider feels linear to the ear and the
 * existing mute toggle stays independent (mute = destination.mute).
 */
export async function setMasterVolume(fraction: number) {
  try {
    const v = Math.max(0.001, Math.min(1, fraction));
    Tone.getDestination().volume.value = 20 * Math.log10(v);
  } catch {
    // Audio is non-critical: never let a volume change crash the game.
  }
}

export async function playBackground(distort: boolean) {
  try {
    useLowPass = distort;
    if (!bgPlayer) {
      bgPlayer = new Tone.Player({
        url: "/Tones/loop.m4a",
        loop: true,
      });
      tintChain = ZONE_TINTS[pendingTint].build();
      await Tone.loaded();
      bgPlayer.start();
    }
    routeBackground();
  } catch {
    // Audio is non-critical: never let a playback error crash the game.
  }
}

export async function playFX() {
  try {
    if (!fxPlayer) {
      fxPlayer = new Tone.Player({
        url: "/Tones/rock.m4a",
        loop: false,
      }).toDestination();
    }
    await Tone.loaded();
    if (fxPlayer.state === "started") {
      fxPlayer.stop();
    }
    fxPlayer.start();
  } catch {
    // Audio is non-critical: never let a playback error crash the game.
  }
}

// Short synthetic "tock" for menu clicks (pinch/fist confirm). Synthesized
// so no extra audio asset is needed; respects the global mute.
let clickSynth: Tone.MembraneSynth | null = null;

export async function playClick() {
  try {
    if (!clickSynth) {
      clickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
      }).toDestination();
      clickSynth.volume.value = -18;
    }
    await Tone.loaded();
    clickSynth.triggerAttackRelease("C5", 0.05);
  } catch {
    // Audio is non-critical: never let a playback error crash the game.
  }
}
