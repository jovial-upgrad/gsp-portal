import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../../components/Button";
import { PreviewSheet, type DocRef } from "../../components/DocView";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import {
  AREAS,
  LEVELS,
  type Campus,
  type Course,
  type University,
} from "../../data/courses";
import {
  sampleAnnouncements,
  statusOf,
  universityNews,
  type Announcement,
} from "../../institution/data/announcements";
import { AssistMark } from "../applications/parts";
import { CampusLife, photosOf } from "./CampusLife";
import { Box, Tile, UniLogo } from "./parts";

const ease = [0.2, 0.8, 0.2, 1] as const;
export const mapsUrl = (u: University, k: Campus) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${u.name}, ${k.address || `${k.name}, ${k.city}`}`)}`;
const plain = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
const firstSentence = (md: string) =>
  (plain(md).match(/[^.!?]+[.!?]/) ?? [plain(md)])[0].trim();
const dateText = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** A campus with a map tile: its address, setting and a map link (30 Oct: nothing about regional visas). */
export function CampusCard({
  u,
  k,
  current = false,
}: {
  u: University;
  k: Campus;
  current?: boolean;
}) {
  return (
    <div className={`cs-campus ${current ? "is-current" : ""}`}>
      <span className="cs-campus__tile" aria-hidden="true">
        <Icon name="pin" size={20} />
      </span>
      <div className="cs-campus__t">
        <p className="cs-campus__name">
          {k.name === k.city ? k.city : `${k.name} campus`}
          {current && <span className="tag tag--here">This course</span>}
        </p>
        <p className="cs-campus__addr">{k.address ?? k.city}</p>
        <p className="cs-campus__meta">
          {[k.name !== k.city && k.city, k.setting].filter(Boolean).join(" · ")}
        </p>
      </div>
      <a
        className="cs-campus__map"
        href={mapsUrl(u, k)}
        target="_blank"
        rel="noreferrer"
      >
        Map
        <Icon name="external" size={14} />
        <span className="vh"> of {k.name}, opens in a new tab</span>
      </a>
    </div>
  );
}

/** A few lines about the university: its own line, then what it is, where, and what GSP lists of it. */
function describe(u: University, courses: Course[]) {
  const mine = courses.filter((x) => x.uni.id === u.id);
  const areas = AREAS.filter((a) => mine.some((x) => x.area === a));
  const cities = [...new Set(u.campuses.map((k) => k.city))];
  const intakes = [
    ...new Set(
      mine.flatMap((x) => x.intakes.map((i) => i.month.split(" ")[0])),
    ),
  ];
  const lines = [
    u.about,
    [
      u.kind
        ? `${u.kind.replace(/^./, (m) => m.toUpperCase())}`
        : "A university",
      u.founded ? ` founded in ${u.founded}` : "",
      ` in ${u.country}`,
      u.qs ? `, ranked #${u.qs} in the QS World University Rankings` : "",
      u.group ? ` and part of the ${u.group}` : "",
      ".",
    ].join(""),
    `${u.campuses.length === 1 ? "It teaches at one campus" : `It has ${u.campuses.length} campuses`}, in ${cities.join(", ")}.`,
    mine.length
      ? `GSP lists ${new Set(mine.map((x) => x.name)).size} of its courses${areas.length ? `, in ${areas.slice(0, 3).join(", ").toLowerCase()}${areas.length > 3 ? " and more" : ""}` : ""}${intakes.length ? `, with intakes in ${intakes.slice(0, 3).join(", ")}` : ""}.`
      : "",
  ];
  return lines.filter(Boolean).join(" ");
}

/**
 * The university, as every role shows it in a course's dialog (Nesil, 3 Nov: the same in RP Admin, GSP Team, GSP ·
 * Institution and GSP · Admin): its logo, website and a description; its facts; Campus life; its recent
 * announcements, which GSP Assist can sum up; what it teaches (top disciplines and program levels); and every campus.
 */
export function UniTab({
  c,
  courses,
  anns,
}: {
  c: Course;
  courses: Course[];
  anns?: Announcement[];
}) {
  const u = c.uni;
  const life = photosOf(u);
  const facts: [string, string][] = [
    ...(u.kind ? ([["Type", u.kind]] as [string, string][]) : []),
    ...(u.founded
      ? ([["Founded", String(u.founded)]] as [string, string][])
      : []),
    ["QS world ranking", u.qs ? `#${u.qs}` : "Not ranked"],
    ...(u.group ? ([["Group", u.group]] as [string, string][]) : []),
  ];
  return (
    <>
      <section className="cs-uni" aria-labelledby="cs-uni-name">
        <div className="cs-uni__head">
          <UniLogo u={u} />
          <div className="cs-uni__titles">
            <h3 id="cs-uni-name" className="cs-uni__name">
              {u.name}
            </h3>
            {u.website && (
              <a
                className="cs-web"
                href={`https://${u.website}`}
                target="_blank"
                rel="noreferrer"
              >
                {u.website}
                <Icon name="external" size={14} />
                <span className="vh"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
        <p className="cs-uni__about">{describe(u, courses)}</p>
        <dl className="cm-tiles">
          {facts.map(([k, v]) => (
            <Tile key={k} k={k} v={v} />
          ))}
        </dl>
      </section>

      <Box id="cs-life" icon="building" title="Campus life">
        <CampusLife list={life} />
      </Box>

      <News c={c} anns={[...(anns ?? SAMPLES), ...UNI_NEWS]} />

      <Offer u={u} courses={courses} />

      <Box
        id="cs-campuses"
        icon="pin"
        title={
          u.campuses.length === 1 ? "Campus" : `${u.campuses.length} campuses`
        }
      >
        <ul className="cs-campuses">
          {u.campuses.map((k) => (
            <li key={k.name}>
              <CampusCard u={u} k={k} current={k.name === c.campus.name} />
            </li>
          ))}
        </ul>
      </Box>
    </>
  );
}

/** The team's sample announcements (for RP Admin and GSP Team, which keep none of their own), and every university's. */
const SAMPLES = sampleAnnouncements();
const UNI_NEWS = universityNews();

/** Aimed at a program level or study area, and this course is one of them. */
const fits = (a: Announcement, c: Course) =>
  (a.levels.length > 0 || a.areas.length > 0) &&
  (!a.levels.length || a.levels.includes(c.level)) &&
  (!a.areas.length || a.areas.includes(c.area));

/** Where GSP Assist is in a summary: reading each announcement, picking out what matters, then writing it up. */
type Phase = "idle" | "read" | "think" | "write" | "done";
/** How long each step takes, in ms: an announcement read, the facts picked out (plus a beat each), a line written. */
const READ_MS = 650;
const THINK_MS = 450;
const FACT_MS = 200;
const WRITE_MS = 340;

/** What GSP Assist picks out of an announcement: a date, a share, an amount or an intake; else what kind it is. */
function factOf(a: Announcement) {
  const t = plain(a.body);
  const m =
    t.match(/\b\d{1,2} [A-Z][a-z]{2,8} \d{4}\b/) ??
    t.match(/\b\d+(?: to \d+)?%/) ??
    t.match(/\b[A-Z]{3} [\d,]+\b/) ??
    t.match(
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/,
    );
  return `${a.category}: ${m ? m[0] : a.subcategory || a.title.split(": ").pop()}`;
}

/**
 * The university's recent announcements (Nesil, 3 Nov), live ones first, newest first, each with its category, date
 * and first lines (Read more for the rest). 3 Nov (later): **Summarise** sits in the header (no count there), and the
 * list shows three at once, the rest on scroll. Summarising shows GSP Assist at work, not a loader: it **reads** each
 * announcement in turn (the one it's on lights up in the list, with a sweep across it, and the list scrolls to it),
 * **picks out** what matters (a date, a share, an amount, for this course), then **writes** the summary line by line.
 * With reduced motion the summary just appears.
 */
function News({ c, anns }: { c: Course; anns: Announcement[] }) {
  const u = c.uni;
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [k, setK] = useState(0);
  const [open, setOpen] = useState<string[]>([]);
  // 4 Nov: an attachment, opened: an image in a pop-up of its own, a document in the document preview
  const [image, setImage] = useState<Picture | null>(null);
  const [doc, setDoc] = useState<DocRef | null>(null);
  const lastImage = useRef<Picture | null>(null);
  const lastDoc = useRef<DocRef | null>(null);
  if (image) lastImage.current = image;
  if (doc) lastDoc.current = doc;
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const now = Date.now();
  const list = anns
    .filter(
      (a) =>
        a.unis.includes(u.id) &&
        (statusOf(a, now) === "Live" ||
          (statusOf(a, now) === "Expired" &&
            now - new Date(`${a.expires}T23:59:59`).getTime() <
              90 * 86_400_000)),
    )
    .sort(
      (a, b) =>
        Number(statusOf(b, now) === "Live") -
          Number(statusOf(a, now) === "Live") ||
        Number(fits(b, c)) - Number(fits(a, c)) ||
        b.publish.localeCompare(a.publish),
    )
    .slice(0, 4);
  const live = list.filter((a) => statusOf(a, now) === "Live");
  const mine = list.filter((a) => fits(a, c)).length;
  const ids = list.map((a) => a.id).join();

  // the summary: a line for each announcement, then where they stand
  const lines: [string, string][] = [
    ...list.map((a): [string, string] => [
      a.category,
      `${firstSentence(a.body) || a.title}${fits(a, c) ? " (for this course)" : ""}${statusOf(a, now) === "Expired" ? " (now ended)" : ""}`,
    ]),
    [
      "",
      `${
        live.length === list.length
          ? list.length === 1
            ? "It’s live now."
            : `All ${list.length} are live now.`
          : `${live.length} live now; ${list.length - live.length} ended in the last 90 days.`
      }${mine > 0 ? ` ${mine === 1 ? "One is" : `${mine} are`} for this course’s program level or study area.` : ""}`,
    ],
  ];
  const facts = [
    ...new Set([
      ...list.map(factOf),
      ...(mine ? ["For this course"] : []),
    ]),
  ];

  // a new course or university starts over
  useEffect(() => {
    window.clearTimeout(t.current);
    setPhase("idle");
    setK(0);
  }, [ids]);
  // each step, then the next
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const ms =
      phase === "read"
        ? READ_MS
        : phase === "think"
          ? THINK_MS + facts.length * FACT_MS
          : WRITE_MS;
    t.current = window.setTimeout(() => {
      if (phase === "read") {
        if (k + 1 < list.length) setK(k + 1);
        else (setPhase("think"), setK(0));
      } else if (phase === "think") (setPhase("write"), setK(0));
      else if (k + 1 < lines.length) setK(k + 1);
      else setPhase("done");
    }, ms);
    return () => window.clearTimeout(t.current);
  }, [phase, k]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = () => {
    setK(0);
    setPhase(reduce ? "done" : "read");
  };

  // three at once: the list is as tall as its first three, and scrolls for the rest
  const box = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState<number | undefined>();
  const [atEnd, setAtEnd] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const items = el.querySelectorAll<HTMLElement>(".cs-news__item");
      if (items.length <= 3) return setCap(undefined);
      const third = items[2];
      setCap(third.offsetTop + third.offsetHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    el.querySelectorAll(".cs-news__item").forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [ids, open]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () =>
      setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [cap, ids]);
  // while reading, the list keeps the one being read in view; once read, back to the top
  useEffect(() => {
    const el = box.current;
    if (!el || !cap) return;
    if (phase === "read") {
      const item = el.querySelectorAll<HTMLElement>(".cs-news__item")[k];
      if (
        item &&
        (item.offsetTop < el.scrollTop ||
          item.offsetTop + item.offsetHeight > el.scrollTop + el.clientHeight)
      )
        el.scrollTo({ top: item.offsetTop, behavior: "smooth" });
    } else if (phase === "think") el.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, k, cap]);
  const more = list.length > 3;
  const working = phase === "read" || phase === "think" || phase === "write";
  const label =
    phase === "read"
      ? `Reading ${k + 1} of ${list.length}…`
      : phase === "think"
        ? "Understanding what changed…"
        : phase === "write"
          ? "Summarising…"
          : `${list.length === 1 ? "The announcement" : `${list.length} announcements`}, summed up`;

  return (
    <Box
      id="cs-news"
      icon="megaphone"
      title="Recent announcements"
      action={
        list.length > 0 && phase === "idle" ? (
          <button type="button" className="gmail__sum-btn" onClick={start}>
            <AssistMark size={16} />
            Summarise
          </button>
        ) : undefined
      }
    >
      {list.length === 0 ? (
        <p className="cs-news__none">
          No announcements from {u.name} yet. New intakes, scholarships and
          changes to entry show here.
        </p>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {phase !== "idle" && (
              <motion.section
                key="sum"
                className={`gmail__sum cs-news__sum ${working ? "is-working" : ""}`}
                aria-busy={working}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease }}
              >
                <p className="gmail__sum-k" role="status">
                  <AssistMark size={16} motion={working ? "busy" : "idle"} />{" "}
                  GSP Assist · <span className="cs-sum__label">{label}</span>
                </p>
                {phase === "read" && (
                  <div className="cs-sum__read">
                    <span className="cs-sum__meter" aria-hidden="true">
                      {list.map((a, i) => (
                        <span
                          key={a.id}
                          className={
                            i < k ? "is-done" : i === k ? "is-now" : ""
                          }
                        />
                      ))}
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={list[k].id}
                        className="cs-sum__now"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease }}
                      >
                        {list[k].title}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                )}
                {phase === "think" && (
                  <ul className="cs-sum__facts" aria-label="What it picked out">
                    {facts.map((f, i) => (
                      <motion.li
                        key={f}
                        className={f === "For this course" ? "is-mine" : ""}
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{
                          delay: 0.1 + (i * FACT_MS) / 1000,
                          duration: 0.26,
                          ease,
                        }}
                      >
                        {f}
                      </motion.li>
                    ))}
                  </ul>
                )}
                {(phase === "write" || phase === "done") && (
                  <ul className="gmail__sum-list">
                    {lines
                      .slice(0, phase === "done" ? lines.length : k + 1)
                      .map(([b, text], i) => (
                        <li
                          key={i}
                          className={`cs-sum__line ${phase === "write" && i === k ? "is-writing" : ""}`}
                        >
                          <span className="cs-sum__text">
                            {b && <b>{b}:</b>} {text}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </motion.section>
            )}
          </AnimatePresence>
          <div
            ref={box}
            className={`cs-news__scroll ${more ? "is-scroll" : ""} ${more && !atEnd ? "has-more" : ""}`}
            style={cap ? { maxHeight: cap } : undefined}
            // a list that scrolls can be scrolled from the keyboard too
            tabIndex={more ? 0 : undefined}
            role={more ? "region" : undefined}
            aria-label={
              more
                ? `${u.name}’s announcements, ${list.length}; scroll for more`
                : undefined
            }
          >
            <ul className="cs-news__list">
              {list.map((a, i) => {
                const st = statusOf(a, now);
                const more = open.includes(a.id);
                const text = plain(a.body);
                const reading = phase === "read" && i === k;
                return (
                  <li
                    key={a.id}
                    className={`cs-news__item ${st === "Expired" ? "is-ended" : ""} ${reading ? "is-reading" : ""}`}
                  >
                    <p className="cs-news__meta">
                      <span className="tag">{a.category}</span>
                      {fits(a, c) && (
                        <span className="cs-news__mine">For this course</span>
                      )}
                      <span>{dateText(a.publish)}</span>
                      {st === "Expired" && (
                        <span className="cs-news__ended">Ended</span>
                      )}
                    </p>
                    <p className="cs-news__title">{a.title}</p>
                    <p className={`cs-news__text ${more ? "is-open" : ""}`}>
                      {text}
                    </p>
                    {text.length > 160 && (
                      <button
                        type="button"
                        className="btn btn--link cs-news__more"
                        onClick={() =>
                          setOpen((l) =>
                            more ? l.filter((x) => x !== a.id) : [...l, a.id],
                          )
                        }
                        aria-expanded={more}
                      >
                        {more ? "Show less" : "Read more"}
                      </button>
                    )}
                    {a.files.length > 0 && (
                      <Attachments
                        a={a}
                        onImage={setImage}
                        onDoc={setDoc}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      <ImageSheet
        p={image ?? lastImage.current}
        open={!!image}
        onClose={() => setImage(null)}
      />
      {(doc ?? lastDoc.current) && (
        <PreviewSheet
          d={(doc ?? lastDoc.current)!}
          open={!!doc}
          onClose={() => setDoc(null)}
        />
      )}
    </Box>
  );
}

/** An image attached to an announcement: its file, its picture, and the announcement it's from. */
type Picture = { file: string; src: string; from: string };
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

/**
 * An announcement's attachments (4 Nov), small, under it: a thumbnail for each image, a chip with its file name for
 * each document. An image opens in a pop-up of its own; a document in the document preview, with Download.
 */
function Attachments({
  a,
  onImage,
  onDoc,
}: {
  a: Announcement;
  onImage: (p: Picture) => void;
  onDoc: (d: DocRef) => void;
}) {
  const src = (f: string) => (IMAGE.test(f) ? a.art?.[f] : undefined);
  const images = a.files.filter((f) => src(f));
  const docs = a.files.filter((f) => !src(f));
  return (
    <ul className="cs-att" aria-label="Attachments">
      {images.map((f) => (
        <li key={f}>
          <button
            type="button"
            className="cs-att__img"
            title={f}
            onClick={() => onImage({ file: f, src: src(f)!, from: a.title })}
          >
            <img src={src(f)} alt="" loading="lazy" decoding="async" />
            <span className="vh">View {f}</span>
          </button>
        </li>
      ))}
      {docs.map((f) => (
        <li key={f}>
          <button
            type="button"
            className="cs-att__doc"
            title={f}
            onClick={() => onDoc({ name: a.title, file: f })}
          >
            <Icon name={IMAGE.test(f) ? "image" : "file"} size={16} />
            <span className="cs-att__name">{f}</span>
            <span className="vh"> (preview)</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** An attached image, opened: the picture as large as fits, with Download. */
function ImageSheet({
  p,
  open,
  onClose,
}: {
  p: Picture | null;
  open: boolean;
  onClose: () => void;
}) {
  const save = () => {
    if (!p) return;
    const link = document.createElement("a");
    link.href = p.src;
    link.download = p.file;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      center
      className="cs-lightbox"
      title={p?.from ?? ""}
      sub={<span className="dprev__file">{p?.file}</span>}
      footer={
        <div className="asf">
          <div className="asf__acts">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              iconLeft={<Icon name="download" size={16} />}
              onClick={save}
            >
              Download
            </Button>
          </div>
        </div>
      }
    >
      {p && (
        <figure className="cs-lightbox__fig">
          <img src={p.src} alt={`${p.file}, attached to the announcement`} />
        </figure>
      )}
    </Sheet>
  );
}

/**
 * What the university teaches, from the courses GSP lists for it (a course taught at two campuses counts once):
 * its top disciplines with a bar for each, and the program levels it offers, side by side.
 */
function Offer({ u, courses }: { u: University; courses: Course[] }) {
  const names = (pick: (c: Course) => boolean) =>
    new Set(
      courses.filter((x) => x.uni.id === u.id && pick(x)).map((x) => x.name),
    ).size;
  const total = names(() => true);
  const areas = AREAS.map((a) => [a, names((x) => x.area === a)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const levels = LEVELS.map(
    (l) => [l, names((x) => x.level === l)] as const,
  ).filter(([, n]) => n > 0);
  const most = areas[0]?.[1] ?? 1;
  const n = (k: number) => `${k} ${k === 1 ? "course" : "courses"}`;
  return (
    <div className="cm-grid">
      <Box
        id="cs-areas"
        icon="award"
        title="Top disciplines"
        meta={`${n(total)} on GSP`}
      >
        <ul className="cs-bars">
          {areas.map(([a, k]) => (
            <li key={a} className="cs-bar">
              <span className="cs-bar__k">{a}</span>
              <span className="cs-bar__n num">{n(k)}</span>
              <span className="cs-bar__track" aria-hidden="true">
                <span style={{ width: `${(k / most) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </Box>
      <Box id="cs-levels" icon="cap" title="Program levels">
        <ul className="cs-levels">
          {levels.map(([l, k]) => (
            <li key={l} className="cs-level">
              <Icon name="checkCircle" size={18} />
              <span className="cs-level__k">{l}</span>
              <span className="cs-level__n num">{n(k)}</span>
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}
