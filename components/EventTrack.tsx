interface EventTrackProps {
  round: number;
  maxEvents: number;
  done?: boolean;
}

export default function EventTrack({ round, maxEvents, done = false }: EventTrackProps) {
  return (
    <div className="event-track chat-scroll" aria-label="本局事件进度">
      <span className="event-track-label">事件轨道</span>
      {Array.from({ length: maxEvents }, (_, index) => index + 1).map((value) => {
        const state = done || value < round ? "done" : value === round ? "current" : "future";
        return (
          <span key={value} className={`track-node ${state}`} title={`第 ${value} 个事件`}>
            {state === "done" ? "✓" : value}
          </span>
        );
      })}
      <span className={`track-node finale ${done ? "done" : ""}`}>年鉴</span>
      <span className="event-track-count">
        {done ? "本局结束" : `第 ${round} / ${maxEvents} 张`}
      </span>
    </div>
  );
}
