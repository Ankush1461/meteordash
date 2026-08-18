"use client";

import React from "react";
import Image from "next/image";
import {
  Camera,
  Coffee,
  Hand,
  HandMetal,
  Lock,
  Play,
  Rocket,
  ShieldCheck,
  Trophy,
  UnfoldHorizontal,
} from "lucide-react";
import { RocketSprite } from "./RocketComponent";
import SocialMediaLinks from "./SocialLinks";
import { type RocketSkin, type SkinId } from "@/utils/skins";

type LandingPageProps = {
  onStartGame: () => void;
  onOpenLeaderboard: () => void;
  onOpenSupport: () => void;
  highScore: number;
  skin: RocketSkin;
  skins: RocketSkin[];
  unlockedSkinIds: SkinId[];
  onSelectSkin: (id: SkinId) => void;
};

export default function LandingPage({
  onStartGame,
  onOpenLeaderboard,
  onOpenSupport,
  highScore,
  skin,
  skins,
  unlockedSkinIds,
  onSelectSkin,
}: LandingPageProps) {
  return (
    <div
      data-menu-scroll
      className="no-scrollbar relative z-30 flex h-full max-h-screen w-full max-w-2xl flex-col justify-between gap-0 px-6 py-4 select-none overflow-hidden"
    >
      {/* ── TOP: Status Bar ── */}
      <div className="flex items-center justify-between font-mono text-[11px] tracking-widest uppercase pb-1 border-b border-white/8">
        <div className="flex items-center gap-2 text-cyan-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>METEORDASH OS v2.1</span>
        </div>
        {highScore > 0 ? (
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Trophy size={12} />
            <span>BEST: {highScore.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-white/25">[ NO RECORDS ]</span>
        )}
      </div>

      {/* ── CENTER CONTENT ── */}
      <div className="flex flex-col gap-5 flex-1 justify-center py-4">

        {/* LOGO */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-radial from-cyan-500/20 via-orange-500/10 to-transparent blur-3xl animate-pulse" />
          <div className="relative w-full max-w-[460px]">
            <Image
              src="/Images/meteordash.png"
              width={460}
              height={180}
              alt="MeteorDash Logo"
              priority
              className="drop-shadow-[0_0_24px_rgba(6,182,212,0.8)] hover:scale-[1.01] transition-transform duration-500"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>

        {/* TAGLINE */}
        <p className="text-center font-mono text-sm tracking-[0.2em] text-white/55 uppercase">
          Dodge Asteroids · Battle Bosses · Survive With Bare Hands
        </p>

        {/* LAUNCH CTA */}
        <button
          type="button"
          onClick={onStartGame}
          id="start-game-button"
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-red-500/80 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 py-4 text-xl font-black text-white shadow-[0_0_35px_rgba(239,68,68,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_55px_rgba(249,115,22,0.65)] hover:border-amber-400 active:scale-[0.98] font-mono tracking-widest"
        >
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <Play size={22} className="fill-white shrink-0" />
          LAUNCH MISSION
          <Rocket size={22} className="text-amber-200 shrink-0 transition-transform duration-300 group-hover:rotate-45 group-hover:translate-x-1" />
        </button>

        {/* BOTTOM 2-COLUMN SECTION */}
        <div className="grid grid-cols-2 gap-4">

          {/* LEFT: Gestures + Camera note */}
          <div className="flex flex-col gap-3">
            {/* Section label */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Pilot Manual</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <div className="flex flex-col gap-2">
              {[
                { icon: <UnfoldHorizontal size={14} className="text-sky-400 shrink-0" />, label: "Spread", action: "Hyper Dash", color: "text-sky-400" },
                { icon: <Hand size={14} className="text-emerald-400 shrink-0" />, label: "Flat Palm", action: "Energy Shield", color: "text-emerald-400" },
                { icon: <HandMetal size={14} className="text-red-400 shrink-0" />, label: "Fist", action: "Pause Mission", color: "text-red-400" },
                {
                  icon: (
                    <span className="flex h-[14px] w-[14px] items-center justify-center shrink-0">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-400" />
                    </span>
                  ),
                  label: "Pinch",
                  action: "Plasma Blaster",
                  color: "text-sky-400",
                },
              ].map(({ icon, label, action, color }) => (
                <div key={label} className="flex items-center gap-3">
                  {icon}
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold font-mono ${color}`}>{label}</span>
                    <span className="text-[10px] text-white/40 font-mono">→ {action}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Camera note */}
            <div className="flex items-start gap-2 pt-2 border-t border-white/8">
              <Camera size={13} className="text-amber-300/80 mt-0.5 shrink-0" />
              <p className="font-mono text-[10px] text-white/45 leading-relaxed">
                Webcam required for gesture tracking. Video processed{" "}
                <span className="text-emerald-400 font-semibold">100% locally</span> — never stored or sent.
              </p>
              <ShieldCheck size={13} className="text-emerald-400/70 mt-0.5 shrink-0" />
            </div>
          </div>

          {/* RIGHT: Hangar */}
          <div className="flex flex-col gap-3">
            {/* Section label */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Hangar</span>
              <span className="font-mono text-[10px] text-white/25">{unlockedSkinIds.length}/{skins.length}</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {/* Active ship */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-black/50"
                style={{ borderColor: skin.glow, boxShadow: `0 0 14px ${skin.glow}55` }}
              >
                <RocketSprite skin={skin} size={34} />
              </div>
              <div>
                <div className="text-base font-black" style={{ color: skin.glow }}>{skin.name}</div>
                <div className="text-[10px] text-white/45 font-mono leading-tight line-clamp-2">{skin.description}</div>
              </div>
            </div>

            {/* Skin grid */}
            <div className="flex flex-wrap gap-2">
              {skins.map((s) => {
                const unlocked = unlockedSkinIds.includes(s.id);
                const selected = s.id === skin.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onSelectSkin(s.id)}
                    title={unlocked ? s.name : `Locked — ${s.unlockHint}`}
                    aria-label={unlocked ? s.name : `Locked: ${s.unlockHint}`}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-black/40 transition-all duration-200 ${unlocked ? "cursor-pointer hover:scale-110" : "cursor-not-allowed opacity-25 grayscale"
                      }`}
                    style={{
                      borderColor: selected ? s.glow : unlocked ? `${s.glow}55` : "#27272a",
                      boxShadow: selected ? `0 0 12px ${s.glow}` : undefined,
                    }}
                  >
                    <RocketSprite skin={s} size={20} />
                    {!unlocked && <Lock size={8} className="absolute bottom-0 right-0 text-stone-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER: pinned to bottom ── */}
      <div className="flex items-center justify-between pt-3 border-t border-white/8">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-2 font-mono text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-900/30 hover:border-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
          >
            <Trophy size={13} />
            LEADERBOARD
          </button>
          <button
            type="button"
            onClick={onOpenSupport}
            className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-950/20 px-3.5 py-2 font-mono text-xs font-bold text-orange-300 transition-all hover:bg-orange-900/30 hover:border-orange-400 hover:text-orange-200 hover:shadow-[0_0_12px_rgba(249,115,22,0.25)]"
          >
            <Coffee size={13} />
            SUPPORT
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SocialMediaLinks />
          <span className="font-mono text-[10px] text-white/20">© 2026 Ankush Karmakar</span>
        </div>
      </div>
    </div>
  );
}
