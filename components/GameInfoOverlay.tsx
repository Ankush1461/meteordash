import { Loader2, RocketIcon } from "lucide-react";
import React from "react";
import SocialMediaLinks from "./SocialLinks";
import Image from "next/image";

type Props = {
  info: any;
};

const GameInfoOverlay = ({ info }: Props) => {
  const {
    isLoading,
    isDetected,
    isColliding,
    distance,
    livesRemainingState,
    isGameOver,
    highScore,
  } = info;
  const lives = [];
  for (let i = 0; i < livesRemainingState; i++) {
    lives.push(<RocketIcon key={i} size={20} className="fill-red-600" />);
  }
  return (
    <div
      className={`absolute z-30 h-screen w-screen flex items-center justify-center ${
        isColliding && "border-[18px] border-red-600 "
      }`}
    >
      {isLoading && (
        <div className="flex items-center justify-space-between flex-col gap-10">
          <div className="text-2xl font-bold">
            Welcome to{" "}
            <span className="text-2xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <Loader2 size={80} className="animate-spin" />
        </div>
      )}
      {!isLoading && !isDetected && !isGameOver && distance === 0 && (
        <div className="flex items-center justify-space-between flex-col gap-10">
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash.png" width={80} height={80} alt="" />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <div className="text-2xl animate-ping font-extrabold">
            Let&apos;s start
          </div>
          <div className="text-md  font-bold">
            Show both hands to start and use hand tilting to control movement
          </div>

          <span className="text-2xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
      {!isLoading && !isDetected && !isGameOver && distance > 0 && (
        <div className="flex items-center justify-space-between flex-col gap-8">
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash.png" width={80} height={80} alt="" />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>

          <div className="text-2xl animate-ping font-extrabold">
            P A U S E D
          </div>
          <button
            className="bg-transparent hover:bg-red-600 text-red-600 hover:text-white border border-red-600 hover:border-transparent rounded py-2 px-4"
            onClick={() => window.location.reload()}
          >
            Start Fresh
          </button>
          <div className="text-md font-bold">
            Show both hands to continue...
          </div>
          <span className="text-xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
      {isGameOver && (
        <div className="flex items-center justify-space-between flex-col gap-8">
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash.png" width={80} height={80} alt="" />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <div className="text-2xl animate-ping font-extrabold">GAME OVER</div>
          <div className="text-xl  font-extrabold">
            {`Your High Score: ${highScore}`}
          </div>

          <button
            className="bg-transparent hover:bg-red-600 text-red-600 hover:text-white border border-red-600 hover:border-transparent rounded py-2 px-4"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
          <span className="text-2xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
      <div className="fixed top-2 right-6">{`High Score: ${
        highScore > 0 ? highScore : 0
      }`}</div>
      <div className="fixed top-6 right-6">{`Distance: ${distance}`}</div>
      <div className="fixed top-12 right-6 flex flex-row gap-1">{lives}</div>
    </div>
  );
};

export default GameInfoOverlay;
