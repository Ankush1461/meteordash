"use client";
import Image from "next/image";
import BossAccessory from "@/components/BossAccessory";
import BoulderComponent from "@/components/BoulderComponent";
import GameInfoOverlay from "@/components/GameInfoOverlay";
import HandRecognizer from "@/components/HandRecognizer";
import Particle from "@/components/Particle";
import RocketComponent from "@/components/RocketComponent";
import Starfield from "@/components/Starfield";
import TutorialOverlay from "@/components/TutorialOverlay";
import {
  playBackground,
  setMasterVolume,
  setMuted as setAudioMuted,
  unlockAudio,
} from "@/utils/audioHandler";
import Cookies from "js-cookie";
import { SKINS, getSkin, isSkinUnlocked } from "@/utils/skins";
import {
  BOSS_SPRITES,
  bossProjectileStyle,
  getBossStyle,
} from "@/lib/game/bosses";
import { getZone } from "@/lib/game/zones";
import { spriteScale } from "@/lib/game/physics";
import { MAX_SENSITIVITY, MIN_SENSITIVITY } from "@/lib/game/constants";
import { POWER_UP_COLORS } from "@/lib/game/powerupColors";
import { useGameEngine } from "@/hooks/useGameEngine";
import {
  BookOpen,
  Hand,
  HandMetal,
  Heart,
  Shield,
  Timer,
  UnfoldHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const engine = useGameEngine();
  const {
    isDetected,
    isLoading,
    cameraError,
    lowLight,
    cameraRetry,
    retryCamera,
    gameState,
    countdown,
    isColliding,
    distance,
    livesRemainingState,
    reserveLives,
    highScore,
    combo,
    shield,
    gestureShield,
    frosted,
    isDashing,
    zone,
    zoneBanner,
    bossActive,
    bossFlash,
    bossBarVisible,
    bossProjectiles,
    boulders,
    particles,
    powerUps,
    scorePopups,
    bolts,
    shootMeter,
    tutorialStep,
    badges,
    skinId,
    selectSkin,
    gameOverStats,
    sensitivity,
    changeSensitivity,
    leaderboardRefresh,
    postedRunId,
    pendingQualify,
    confirmLeaderboardName,
    dismissLeaderboardName,
    confettiSeed,
    leaderboardOpen,
    setLeaderboardOpen,
    completeTutorial,
    setHandResults,
    rocketRef,
    rocketTiltRef,
    shakeWrapperRef,
    starfieldSpeedRef,
    shieldRingRef,
    bossRef,
    bossBarFillRef,
    registerBoulderEl,
    registerParticleEl,
    registerBoltEl,
    menuCursorRef,
    menuBackRef,
    guideOpenRef,
    powerUpElsRef,
    scorePopupElsRef,
    bossProjectileElsRef,
    registerTiltMarker,
  } = engine;

  // --- Page-local UI state (audio, gesture guide, rocket vertical home) ---
  const [isMuted, setIsMuted] = useState(false);
  // Master volume, 0–1. Defaults to 50% and persists (like skins/badges) so
  // players don't reset their level on every page load.
  const [volume, setVolume] = useState<number>(() => {
    const saved = Cookies.get("mdVolume");
    const v = saved ? parseFloat(saved) : NaN;
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  });
  const [guideOpen, setGuideOpen] = useState(false);
  // Vertical home of the rocket, derived from the viewport so it sits near
  // the bottom on any screen size (previously a hardcoded 500px, which left
  // it floating mid-screen on desktop). Fixed initial value avoids an
  // SSR/client hydration mismatch; the effect sets the real one post-mount.
  const [rocketY, setRocketY] = useState(500);
  // Viewport sprite scale (1 = 1280px reference). Fixed at 1 for SSR so the
  // server HTML and first client render agree; the resize effect sets the
  // real value after mount (see below).
  const [spriteSz, setSpriteSz] = useState(1);

  // Hand-gesture menu navigation: the engine closes the gesture guide via
  // menuBackRef (spread = back) and reads guideOpenRef to defer run-start
  // while it's open — wire the page-local state both ways.
  useEffect(() => {
    guideOpenRef.current = guideOpen;
    menuBackRef.current = () => setGuideOpen(false);
  }, [guideOpen, guideOpenRef, menuBackRef]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setAudioMuted(next);
  };

  const changeVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    Cookies.set("mdVolume", String(clamped), { expires: 365 });
  };

  // Apply the master volume (initial + on change). Tone's destination node
  // exists before the context starts, so the gain is in place as soon as
  // audio unlocks on the first interaction.
  useEffect(() => {
    setMasterVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (gameState === "countdown" || gameState === "playing") {
      playBackground(false);
    } else {
      playBackground(true);
    }
  }, [gameState]);

  // Keep the rocket at a fixed fraction of the viewport height so the
  // meteor fall time to the ship is the same on every screen (a fixed
  // bottom margin gave tall screens extra reaction time). The floor keeps
  // it on-screen on very short windows. Also sets the viewport sprite
  // scale for the rocket/boss so SSR and client agree on the first paint.
  useEffect(() => {
    const apply = () => {
      setRocketY(Math.max(360, window.innerHeight * 0.72));
      setSpriteSz(spriteScale());
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Browsers block audio until the first user gesture; unlock once on any
  // pointer/key interaction so background music and FX can actually play.
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const zoneTheme = getZone(zone);
  const bossStyle = getBossStyle(zone);
  const skin = getSkin(skinId);
  // Which skins are currently unlocked (badge-based + score milestones).
  const unlockedSkinIds = useMemo(
    () =>
      SKINS.filter((s) =>
        isSkinUnlocked(
          s,
          badges.filter((b) => b.unlocked).map((b) => b.id),
          highScore
        )
      ).map((s) => s.id),
    [badges, highScore]
  );

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-24">
      {/* Zone theme tint behind everything */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: zoneTheme.bg }}
      />
      <div
        className={`absolute left-3 top-3 z-30 transition-all duration-500 ${
          isDetected ? "w-24" : "w-48"
        } `}
      >
        <HandRecognizer
          setHandResults={setHandResults}
          retryAttempt={cameraRetry}
        />
      </div>
      <div ref={shakeWrapperRef} className="absolute inset-0">
        <Starfield speedRef={starfieldSpeedRef} />
        <div className="absolute z-10 h-screen w-screen overflow-hidden">
          {boulders.map((b) => (
            <BoulderComponent
              key={b.key}
              boulder={b}
              registerEl={registerBoulderEl}
              filter={zoneTheme.meteorFilter}
            />
          ))}
        </div>
        <div className="absolute z-20 h-screen w-screen overflow-hidden pointer-events-none">
          {particles.map((p) => (
            <Particle
              key={p.key}
              particle={p}
              registerEl={registerParticleEl}
            />
          ))}
        </div>
        {/* Player bolts (pinch-to-fire): the loop moves them via transforms. */}
        <div className="absolute z-[16] h-screen w-screen overflow-hidden pointer-events-none">
          {bolts.map((b) => (
            <div
              key={b.key}
              ref={(el) => registerBoltEl(b.key, el)}
              className="absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: b.size,
                height: b.size,
                backgroundColor: b.charge >= 0.75 ? "#7dd3fc" : "#e0f2fe",
                boxShadow: `0 0 ${
                  b.charge >= 0.75 ? 18 : 10
                }px ${b.charge >= 0.75 ? "rgba(56,189,248,0.9)" : "rgba(125,211,252,0.7)"}`,
                transform: `translate3d(-999px, 0, 0)`,
              }}
            />
          ))}
        </div>
        <div className="absolute z-[15] h-screen w-screen overflow-hidden pointer-events-none">
          {powerUps.map((p) => (
            <div
              key={p.key}
              ref={(el) => {
                if (el) {
                  powerUpElsRef.current.set(p.key, el);
                } else {
                  powerUpElsRef.current.delete(p.key);
                }
              }}
              className="absolute"
              style={{
                left: 0,
                top: 0,
                width: p.size,
                height: p.size,
                transform: `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`,
              }}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-full border-2 bg-black/50"
                style={{
                  borderColor: POWER_UP_COLORS[p.type],
                  boxShadow: `0 0 18px 6px ${POWER_UP_COLORS[p.type]}55`,
                }}
              >
                {p.type === "shield" && (
                  <Shield size={18} color={POWER_UP_COLORS.shield} />
                )}
                {p.type === "slowmo" && (
                  <Timer size={18} color={POWER_UP_COLORS.slowmo} />
                )}
                {p.type === "double" && (
                  <span
                    className="text-sm font-extrabold"
                    style={{ color: POWER_UP_COLORS.double }}
                  >
                    ×2
                  </span>
                )}
                {p.type === "life" && (
                  <Heart size={18} color={POWER_UP_COLORS.life} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="absolute z-30 h-screen w-screen overflow-hidden pointer-events-none">
          {scorePopups.map((sp) => (
            <div
              key={sp.key}
              ref={(el) => {
                if (el) {
                  scorePopupElsRef.current.set(sp.key, el);
                } else {
                  scorePopupElsRef.current.delete(sp.key);
                }
              }}
              className="absolute text-base font-extrabold"
              style={{
                left: 0,
                top: 0,
                color: sp.color,
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                transform: `translate3d(${sp.x}px, ${sp.y}px, 0)`,
              }}
            >
              {sp.text}
            </div>
          ))}
        </div>
        {bossActive && (
          <>
            <div
              ref={bossRef}
              className="absolute z-10 pointer-events-none"
              style={{ left: 0, top: 0, transform: "translate3d(-999px, 0, 0)" }}
            >
              {/* Themed circular energy aura + signature accessory per zone */}
              <div
                className="boss-aura absolute rounded-full"
                style={{
                  left: "50%",
                  top: "50%",
                  width: bossStyle.auraSize,
                  height: bossStyle.auraSize,
                  background: `radial-gradient(circle, ${bossStyle.aura})`,
                }}
              />
              <BossAccessory kind={bossStyle.accessory} />
              <Image
                src={BOSS_SPRITES[(zone - 1) % BOSS_SPRITES.length]}
                width={140 * spriteSz}
                height={140 * spriteSz}
                // The guardian is a mid-game LCP element (big + centered);
                // eager keeps it from tripping the LCP lazy-load warning.
                loading="eager"
                alt=""
                style={{
                  // Pin BOTH rendered dimensions explicitly. Tailwind's
                  // preflight `img { height: auto }` would otherwise size the
                  // height from the sprite's intrinsic ratio (the asteroid
                  // sheet is 1582×1600), leaving the rendered height out of
                  // sync with the width attribute — which is exactly the
                  // condition Next's aspect-ratio check warns about.
                  width: `${140 * spriteSz}px`,
                  height: `${140 * spriteSz}px`,
                  // No zone tint — the guardian sprites have their own colors.
                  filter: `drop-shadow(0 0 16px rgba(${bossStyle.glowRgb}, 0.65)) drop-shadow(0 0 44px rgba(${bossStyle.glowRgb}, 0.35))`,
                }}
              />
            </div>
            <div className="absolute z-10 h-screen w-screen overflow-hidden pointer-events-none">
              {bossProjectiles.map((p) => (
                <div
                  key={p.key}
                  ref={(el) => {
                    if (el) {
                      bossProjectileElsRef.current.set(p.key, el);
                    } else {
                      bossProjectileElsRef.current.delete(p.key);
                    }
                  }}
                  className="absolute"
                  style={{
                    left: 0,
                    top: 0,
                    width: p.size,
                    height: p.size,
                    transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
                  }}
                >
                  {/* Inner div holds the sprite/gradient so the loop can move
                      the outer element while the sprite tumbles on its own
                      transform (projSpin) without fighting the loop. */}
                  <div
                    className="h-full w-full rounded-full"
                    style={bossProjectileStyle(p)}
                  />
                </div>
              ))}
            </div>
            <div
              className="absolute left-1/2 top-6 z-20 w-72 -translate-x-1/2 pointer-events-none"
              style={{
                opacity: bossBarVisible ? 1 : 0,
                transition: "opacity 0.45s ease 0.15s",
              }}
            >
              <div
                className="mb-1 text-center text-xs font-bold uppercase tracking-widest"
                style={{ color: zoneTheme.accent }}
              >
                {zoneTheme.name} Guardian
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-white/40 bg-black/60">
                <div
                  ref={bossBarFillRef}
                  className="h-full rounded-full"
                  style={{ width: "100%", backgroundColor: zoneTheme.accent }}
                />
              </div>
            </div>
          </>
        )}
        {bossFlash && (
          <div
            key="boss-flash"
            className="boss-flash pointer-events-none absolute inset-0 z-40"
          />
        )}
        <div
          ref={rocketRef}
          id="rocket-container"
          className={`${isColliding ? "wiggle" : ""} ${
            isDashing ? "dash-glow" : ""
          }`}
          style={{
            position: "absolute",
            transition: "all",
            marginTop: `${isColliding ? rocketY + 7 : rocketY}px`,
          }}
        >
          {(shield || gestureShield) && (
            <div
              ref={shieldRingRef}
              className="absolute -inset-4 rounded-full border-2 border-sky-400/80 pointer-events-none"
              style={{ boxShadow: "0 0 20px 8px rgba(56, 189, 248, 0.35)" }}
            />
          )}
          {frosted && (
            <div
              className="absolute -inset-3 rounded-full border-2 border-cyan-300/70 pointer-events-none"
              style={{ boxShadow: "0 0 16px 6px rgba(103, 232, 249, 0.3)" }}
            />
          )}
          <RocketComponent
            skin={skin}
            ref={rocketTiltRef}
            size={Math.round(35 * spriteSz)}
          />
        </div>
      </div>
      {/* Hand-driven menu cursor (idle / game-over): the engine moves it via
          transforms and highlights the button under it with .menu-hover. */}
      <div
        ref={menuCursorRef}
        className="menu-cursor pointer-events-none fixed z-[70]"
        style={{
          width: 22,
          height: 22,
          opacity: 0,
          // Pin to the viewport origin: without left/top a fixed element sits
          // at its flex-layout static position (~screen centre), so the
          // engine's translate3d would offset the VISIBLE cursor by half the
          // viewport from where it actually clicks.
          left: 0,
          top: 0,
          transform: "translate3d(-999px, -999px, 0)",
        }}
      />
      <GameInfoOverlay
        isLoading={isLoading}
        isCameraError={cameraError !== null}
        cameraError={cameraError}
        lowLight={lowLight}
        onRetry={retryCamera}
        gameState={gameState}
        countdown={countdown}
        isColliding={isColliding}
        distance={distance}
        livesRemainingState={livesRemainingState}
        reserveLives={reserveLives}
        highScore={highScore}
        leaderboardRefresh={leaderboardRefresh}
        postedRunId={postedRunId}
        pendingQualify={pendingQualify}
        onConfirmName={confirmLeaderboardName}
        onDismissName={dismissLeaderboardName}
        confettiSeed={confettiSeed}
        leaderboardOpen={leaderboardOpen}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onCloseLeaderboard={() => setLeaderboardOpen(false)}
        combo={combo}
        shootMeter={shootMeter}
        boltCount={bolts.filter((b) => !b.hit).length}
        runStats={gameOverStats}
        badges={badges}
        skin={skin}
        skins={SKINS}
        unlockedSkinIds={unlockedSkinIds}
        onSelectSkin={selectSkin}
      />
      {gameState === "tutorial" && (
        <TutorialOverlay
          step={tutorialStep}
          onSkip={completeTutorial}
          registerTiltMarker={registerTiltMarker}
        />
      )}
      {zoneBanner && (
        <div
          key={`${zoneBanner.title}-${zoneBanner.subtitle ?? ""}`}
          className="banner-fade pointer-events-none absolute inset-x-0 top-24 z-30 flex flex-col items-center gap-1"
        >
          <div
            className="text-4xl font-extrabold tracking-wide"
            style={{
              color:
                zoneBanner.variant === "clear" ? "#34d399" : zoneTheme.accent,
            }}
          >
            {zoneBanner.title}
          </div>
          {zoneBanner.subtitle && (
            <div className="text-xl font-bold text-white/90">
              {zoneBanner.subtitle}
            </div>
          )}
          {zoneBanner.objective && (
            <div className="max-w-xl px-6 text-center text-base italic text-white/75">
              {zoneBanner.objective}
            </div>
          )}
        </div>
      )}
      <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2.5 rounded-lg border border-stone-700 bg-stone-900/70 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sensitivity"
            className="text-xs font-bold uppercase tracking-wide text-white"
          >
            Sensitivity {sensitivity.toFixed(1)}×
          </label>
          <input
            id="sensitivity"
            type="range"
            min={MIN_SENSITIVITY}
            max={MAX_SENSITIVITY}
            step={0.1}
            value={sensitivity}
            onChange={(e) => changeSensitivity(parseFloat(e.target.value))}
            className="w-36 accent-red-600"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="volume"
            className="text-xs font-bold uppercase tracking-wide text-white"
          >
            Volume {Math.round(volume * 100)}%
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-36 accent-red-600"
          />
        </div>
        <button
          onClick={toggleMute}
          aria-pressed={isMuted}
          className="flex items-center gap-2 rounded-md border border-stone-700 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-stone-800"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {isMuted ? "Muted" : "Sound: On"}
        </button>
      </div>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => setGuideOpen((o) => !o)}
          aria-expanded={guideOpen}
          className="flex items-center gap-2 rounded-md border border-stone-700 bg-stone-900/70 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-stone-800"
        >
          <BookOpen size={16} />
          {guideOpen ? "Hide Gestures" : "Gesture Guide"}
        </button>
        {guideOpen && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-stone-700 bg-stone-900/80 p-3 text-xs text-white backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <UnfoldHorizontal size={18} className="shrink-0 text-sky-400" />
              <span>
                <span className="font-extrabold">Spread hands</span> — dash
                (invincible)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Hand size={18} className="shrink-0 text-emerald-400" />
              <span>
                <span className="font-extrabold">Flat palms</span> — energy
                shield
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <HandMetal size={18} className="shrink-0 text-red-400" />
              <span>
                <span className="font-extrabold">Fists</span> — pause
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <span className="h-3 w-3 rounded-full border-2 border-sky-400" />
              </span>
              <span>
                <span className="font-extrabold">Pinch (thumb + index)</span> —
                fire a bolt straight up (hold to charge)
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
