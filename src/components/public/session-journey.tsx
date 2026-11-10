"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

export type JourneySession = {
  number: number;
  title: string;
  summary: string | null;
};
export type JourneySkill = {
  name: string;
  kind: "ct" | "hbs";
  sessions: number[];
};

const SIZE = 640;
const C = SIZE / 2;
const OUTER = 250;
const INNER = 158;
const EASE = [0.22, 1, 0.36, 1] as const;

type Point = JourneySkill & { x: number; y: number; angle: number };

function ring(skills: JourneySkill[], radius: number, offset: number): Point[] {
  return skills.map((skill, index) => {
    const angle = -Math.PI / 2 + offset + (index / skills.length) * Math.PI * 2;
    return {
      ...skill,
      angle,
      x: C + Math.cos(angle) * radius,
      y: C + Math.sin(angle) * radius,
    };
  });
}

/**
 * Les six sessions, racontées au défilement : la section reste à l'écran et une
 * constellation des compétences s'allume session après session, d'après la
 * correspondance sessions / compétences du référentiel publié.
 */
export function SessionJourney({
  sessions,
  skills,
}: {
  sessions: JourneySession[];
  skills: JourneySkill[];
}) {
  // Lu après l'hydratation : le serveur ne connaît pas la préférence du visiteur.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (reduce) return <StaticJourney sessions={sessions} skills={skills} />;
  return <PinnedJourney sessions={sessions} skills={skills} />;
}

function skillsOf(skills: JourneySkill[], session: number) {
  return {
    ct: skills.filter(
      (skill) => skill.kind === "ct" && skill.sessions.includes(session),
    ),
    hbs: skills.filter(
      (skill) => skill.kind === "hbs" && skill.sessions.includes(session),
    ),
  };
}

function PinnedJourney({
  sessions,
  skills,
}: {
  sessions: JourneySession[];
  skills: JourneySkill[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.4,
  });
  const count = sessions.length;

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(Math.min(count - 1, Math.max(0, Math.floor(value * count))));
  });

  const points = useMemo(
    () => [
      ...ring(
        skills.filter((skill) => skill.kind === "ct"),
        OUTER,
        0,
      ),
      ...ring(
        skills.filter((skill) => skill.kind === "hbs"),
        INNER,
        Math.PI / 16,
      ),
    ],
    [skills],
  );

  const session = sessions[active];
  if (!session) return null;
  const current = session.number;
  const mobilised = skillsOf(skills, current);

  return (
    <div
      ref={ref}
      style={{ height: `${count * 70 + 40}svh` }}
      className="relative"
    >
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden lg:top-[4.5rem] lg:h-[calc(100svh-4.5rem)]">
        {/* Jauge d'expérience */}
        <div className="container-site pt-6 sm:pt-8">
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-sm text-white/60">Progression</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-orange-500"
                style={{ scaleX: progress }}
              />
            </div>
            <span className="shrink-0 font-display text-sm font-semibold text-white tabular-nums">
              {current}/{count}
            </span>
          </div>
        </div>

        <div className="container-site grid min-h-0 flex-1 items-center gap-6 py-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
          {/* Récit de la session */}
          <div className="order-2 min-h-0 lg:order-1">
            <div className="flex items-end gap-4">
              <span className="relative block h-[clamp(4.5rem,11vw,9.5rem)] overflow-hidden font-display text-[clamp(4.5rem,11vw,9.5rem)] leading-none font-semibold tracking-[-0.06em] text-orange-500 tabular-nums">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={current}
                    className="block"
                    initial={{ y: "100%" }}
                    animate={{
                      y: "0%",
                      transition: { duration: 0.4, ease: EASE },
                    }}
                    exit={{
                      y: "-100%",
                      transition: { duration: 0.2, ease: "easeIn" },
                    }}
                  >
                    {current}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="mb-2 text-white/50 sm:mb-4">sur {count}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <h3 className="mt-3 text-display-md text-white">
                  {session.title}
                </h3>
                {session.summary ? (
                  <p className="mt-3 max-w-lg text-white/70 max-lg:line-clamp-3">
                    {session.summary}
                  </p>
                ) : null}
                {mobilised.ct.length + mobilised.hbs.length > 0 ? (
                  <ul
                    className="mt-5 flex max-w-xl flex-wrap gap-1.5"
                    aria-label={`Compétences mobilisées en session ${current}`}
                  >
                    {mobilised.ct.map((skill, index) => (
                      <motion.li
                        key={skill.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + index * 0.04 }}
                        className="rounded-md bg-orange-500 px-2.5 py-1 text-sm font-medium text-white"
                      >
                        {skill.name}
                      </motion.li>
                    ))}
                    {mobilised.hbs.map((skill, index) => (
                      <motion.li
                        key={skill.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.03 }}
                        className="rounded-md border border-orange-300/40 px-2.5 py-1 text-sm text-orange-200 max-sm:hidden"
                      >
                        {skill.name}
                      </motion.li>
                    ))}
                  </ul>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Constellation */}
          <div className="order-1 mx-auto aspect-[900/660] w-full max-w-[min(100%,58svh)] lg:order-2 lg:max-w-[min(100%,96svh)]">
            <Constellation points={points} current={current} />
          </div>
        </div>

        <div className="container-site flex flex-wrap gap-x-6 gap-y-2 pb-6 text-sm text-white/60 max-sm:hidden">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 rounded-[2px] bg-orange-500"
              aria-hidden
            />{" "}
            Compétence transversale mobilisée
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 rounded-[2px] bg-orange-300"
              aria-hidden
            />{" "}
            Habileté socio-cognitive mobilisée
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 rounded-[2px] bg-petrol-400"
              aria-hidden
            />{" "}
            Déjà travaillée
          </span>
        </div>
      </div>
    </div>
  );
}

function Constellation({
  points,
  current,
}: {
  points: Point[];
  current: number;
}) {
  return (
    <svg
      viewBox={`-130 -10 ${SIZE + 260} ${SIZE + 20}`}
      className="size-full"
      aria-hidden
    >
      {/* Anneaux */}
      <circle
        cx={C}
        cy={C}
        r={OUTER}
        fill="none"
        stroke="rgb(255 255 255 / 0.08)"
        strokeDasharray="2 6"
      />
      <circle
        cx={C}
        cy={C}
        r={INNER}
        fill="none"
        stroke="rgb(255 255 255 / 0.08)"
        strokeDasharray="2 6"
      />
      <circle
        cx={C}
        cy={C}
        r={60}
        fill="rgb(234 99 46 / 0.08)"
        stroke="rgb(234 99 46 / 0.35)"
      />

      {/* Liaisons vers la session */}
      {points.map((point) => {
        const on = point.sessions.includes(current);
        return (
          <motion.line
            key={`l-${point.name}`}
            x1={C}
            y1={C}
            x2={point.x}
            y2={point.y}
            stroke={point.kind === "ct" ? "#ea632e" : "#f4a17e"}
            strokeWidth={1.25}
            initial={false}
            animate={{ pathLength: on ? 1 : 0, opacity: on ? 0.55 : 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          />
        );
      })}

      {/* Compétences */}
      {points.map((point) => {
        const on = point.sessions.includes(current);
        const before =
          !on && point.sessions.some((session) => session < current);
        const color = on
          ? point.kind === "ct"
            ? "#ea632e"
            : "#f4a17e"
          : before
            ? "#76a3ac"
            : "rgb(255 255 255 / 0.18)";
        const size = on ? 14 : before ? 9 : 7;
        const cos = Math.cos(point.angle);
        const label = point.kind === "ct";
        return (
          <g key={point.name}>
            <motion.rect
              initial={false}
              animate={{
                x: point.x - size / 2,
                y: point.y - size / 2,
                width: size,
                height: size,
                fill: color,
              }}
              transition={{ duration: 0.5, ease: EASE }}
              rx={2}
            />
            {label ? (
              <motion.text
                x={point.x + cos * 18}
                y={point.y + Math.sin(point.angle) * 18}
                textAnchor={cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle"}
                dominantBaseline="middle"
                className="font-sans"
                fontSize={17}
                initial={false}
                animate={{
                  opacity: on ? 1 : before ? 0.4 : 0.22,
                  fill: on ? "#ffffff" : "#a5c3c9",
                }}
                transition={{ duration: 0.4 }}
              >
                {point.name}
              </motion.text>
            ) : null}
          </g>
        );
      })}

      {/* Moyeu : numéro de session */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.text
          key={current}
          x={C}
          y={C + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-display"
          fontWeight={600}
          fontSize={44}
          fill="#ffffff"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          {current}
        </motion.text>
      </AnimatePresence>
    </svg>
  );
}

/** Version sans animation (préférence « réduire les animations »). */
function StaticJourney({
  sessions,
  skills,
}: {
  sessions: JourneySession[];
  skills: JourneySkill[];
}) {
  return (
    <ol className="container-site grid gap-px overflow-hidden py-10 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => {
        const mobilised = skillsOf(skills, session.number);
        return (
          <li
            key={session.number}
            className="border-t border-white/10 py-6 pr-6"
          >
            <span className="font-display text-4xl font-semibold text-orange-500">
              {session.number}
            </span>
            <h3 className="mt-2 text-title text-white">{session.title}</h3>
            {session.summary ? (
              <p className="mt-2 text-white/70">{session.summary}</p>
            ) : null}
            {mobilised.ct.length ? (
              <p className="mt-3 text-sm text-orange-200">
                {mobilised.ct.map((skill) => skill.name).join(", ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
