import { RocketIcon } from "lucide-react";
import React from "react";

type Props = {
  degrees: number;
};

const RocketComponent = ({ degrees }: Props) => {
  return (
    <div className="rocket-shadow">
      <RocketIcon
        size={35}
        className="fill-red-500"
        style={{
          transform: `rotate(${-45 - degrees / 2}deg)`,
          transition: "all",
          animationDuration: "10ms",
        }}
      />
    </div>
  );
};

export default RocketComponent;
