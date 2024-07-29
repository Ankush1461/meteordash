import Image from "next/image";
import React, { useEffect, useState } from "react";

type Props = {
  isMoving?: boolean;
};

const BoulderComponent = ({ isMoving }: Props) => {
  const [xState, setXState] = useState(0);
  const [yState, setYState] = useState(0);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    setXState(Math.random() * (window.innerWidth - 80));
    setYState(-Math.random() * 100 - 100);
    setRotation(Math.random() * 360);
  }, []);

  return (
    <div
      className="boulder-shadow"
      style={{
        position: "absolute",
        left: xState,
        top: yState,
        animation: "moveDown 10s linear forwards",
        animationPlayState: isMoving ? "running" : "paused",
      }}
    >
      <Image
        src="/Images/meteor.png"
        alt="meteor"
        width={100}
        height={100}
        style={{ rotate: `${rotation}deg` }}
      />
    </div>
  );
};

export default BoulderComponent;
