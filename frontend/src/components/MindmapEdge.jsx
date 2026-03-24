import { BaseEdge } from "@xyflow/react";

export default function MindmapEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
}) {
  const midX = (sourceX + targetX) / 2;
  // Classic mindmap S-curve: horizontal bezier that fans out from the source
  const edgePath = `M ${sourceX},${sourceY} C ${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  );
}
