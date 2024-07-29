"use client";
import BoulderComponent from "@/components/BoulderComponent";
import HandRecognizer from "@/components/HandRecognizer";
import RocketComponent from "@/components/RocketComponent";
import Image from "next/image";
import { useEffect, useState } from "react";

let generationInterval: any;
let removalInterval: any;
export default function Home() {
  const [rocketLeft, setRocketLeft] = useState(0);
  const [degrees, setDegrees] = useState(0);
  const [IsDetected, setIsDetected] = useState(false);

  const [boulders, setBoulders] = useState<any[]>([{}, {}]);

  useEffect(() => {
    setRocketLeft(window.innerWidth / 2);
  }, []);

  useEffect(() => {
    if (IsDetected) {
      generationInterval = setInterval(() => {
        setBoulders((prev) => {
          let retArr = [...prev];
          for (let i = 0; i < 4; i++) {
            const now = Date.now();
            retArr = [
              ...retArr,
              {
                timestamp: now,
                key: `${now}-${Math.random()}`,
              },
            ];
          }
          return retArr;
        });
      }, 1000);
      removalInterval = setInterval(() => {
        setBoulders((prev) => {
          const now = Date.now();
          return prev.filter((b, i) => {
            return now - b.timestamp < 5000;
          });
        });
      }, 5000);
    }

    return () => {
      clearInterval(generationInterval);
      clearInterval(removalInterval);
    };
  }, [IsDetected]);

  const setHandResults = (result: any) => {
    setIsDetected(result.isDetected);
    setDegrees(result.degrees);
    //set Rocket Left
    if (result.degrees && result.degrees !== 0) {
      setRocketLeft((prev) => {
        const ret = prev - result.degrees / 6;
        if (ret < 20) {
          return prev;
        }
        if (ret > window.innerWidth - 52) {
          return prev;
        }
        return ret;
      });
    }
  };
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute left-3 top-3 z-30 w-24">
        <HandRecognizer setHandResults={setHandResults} />
      </div>
      <div
        id="rocket-container"
        style={{
          position: "absolute",
          left: rocketLeft,
          transition: "all",
          animationDuration: "10ms",
          marginTop: "500px",
        }}
      >
        <RocketComponent degrees={degrees} />
      </div>
      <div className="absolute z-10 h-screen w-screen overflow-hidden">
        {boulders.map((b, i) => {
          return <BoulderComponent key={b.key} isMoving={IsDetected} />;
        })}
      </div>
    </main>
  );
}
