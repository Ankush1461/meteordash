import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Props = {
  isMoving?: boolean;
  what: any;
  soWhat: () => void;
  when: any;
  distance: number;
};

let randomSize = Math.random() * (80 - 10) + 10;

const BoulderComponent = ({
  isMoving,
  what,
  soWhat,
  when,
  distance,
}: Props) => {
  const [xState, setXState] = useState(0);
  const [yState, setYState] = useState(0);
  const [rotation, setRotation] = useState(0);
  const boulderRef = useRef(null);

  const [size, setSize] = useState(0);

  useEffect(() => {
    // detection logic
    detectCollision();
  }, [when]);

  const detectCollision = () => {
    if (boulderRef.current) {
      const boulder = (boulderRef.current as any).getBoundingClientRect();
      const didCollide =
        boulder.left + 28 < what.right &&
        boulder.right - 28 > what.left &&
        boulder.bottom - 28 > what.top &&
        boulder.top + 28 < what.bottom;
      if (didCollide) {
        soWhat();
      }
    }
  };
  useEffect(() => {
    setXState(Math.random() * (window.innerWidth - 80));
    setYState(-Math.random() * 100 - 100);
    setRotation(Math.random() * 360);
    setSize(Math.random() * (80 - 50) + 50);
  }, []);

  return (
    <div
      ref={boulderRef}
      className="boulder-shadow"
      style={{
        position: "absolute",
        left: xState,
        top: yState,
        animation: `moveDown ${
          isMoving && distance > 50 ? 10 - Math.log2(distance / 50) : 10
        }s linear forwards`,
        animationPlayState: isMoving ? "running" : "paused",
      }}
    >
      <Image
        src={"/Images/meteor.png"}
        width={size}
        height={size}
        alt={""}
        style={{
          rotate: `${rotation}deg`,
        }}
      />
    </div>
  );
};

export default BoulderComponent;
