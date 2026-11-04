import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import type { GuideBlock, GuideChip, GuideFigure, GuideIconItem, GuideStep, Rich } from "@/lib/guide";
import { GUIDE_ICONS } from "./guide-icons";
import styles from "./guide.module.css";

/** A button as the screen shows it — an icon and its words in a small pill. */
function Chip({ chip }: { chip: GuideChip }) {
  const Icon = chip.icon ? GUIDE_ICONS[chip.icon] : null;
  return (
    <span className={styles.chip}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {chip.label}
    </span>
  );
}

export function RichText({ text }: { text: Rich }) {
  if (typeof text === "string") return <>{text}</>;
  return (
    <>
      {text.map((part, index) =>
        typeof part === "string" ? <span key={index}>{part}</span> : <Chip key={index} chip={part} />
      )}
    </>
  );
}

/** Up to five steps share one row; six read as two rows of three. */
function stepColumns(count: number): number {
  return count === 6 ? 3 : count;
}

function Steps({ steps }: { steps: readonly GuideStep[] }) {
  const columns = stepColumns(steps.length);
  return (
    <ol className={styles.steps} data-columns={columns}>
      {steps.map((step, index) => (
        <li key={index} className={styles.step}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <strong>{step.title}</strong>
          <span>{step.text}</span>
          {(index + 1) % columns !== 0 && <ArrowRight size={14} className={styles.stepArrow} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

/**
 * A screenshot with its badges drawn over it from the data, so the file stays
 * a plain capture of the screen, and the legend that names each badge.
 */
/**
 * How wide a side picture may be shown: no taller than about 720px, no wider
 * than the 520px its column allows, and no larger than the screen it was taken
 * from — the captures are about 2× the screen's pixels, hence ÷ 1.6.
 */
function sideWidth(figure: GuideFigure): number {
  return Math.min(Math.round((720 * figure.width) / figure.height), 520, Math.round(figure.width / 1.6));
}

function Figure({ figure }: { figure: GuideFigure }) {
  const side = figure.layout === "side";
  return (
    <figure
      className={styles.figure}
      data-layout={figure.layout}
      style={side ? ({ "--media": `${sideWidth(figure)}px` } as CSSProperties) : undefined}
    >
      <div className={styles.figureMedia}>
        <div className={styles.shot}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={figure.src} alt={figure.caption} width={figure.width} height={figure.height} loading="lazy" />
          {figure.marks.map((mark) => (
            <span
              key={mark.n}
              className={styles.badge}
              style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
              aria-hidden="true"
            >
              {mark.n}
            </span>
          ))}
        </div>
        <figcaption>{figure.caption}</figcaption>
      </div>
      {figure.legend.length > 0 && (
        <ol className={styles.legend}>
          {figure.legend.map((item) => (
            <li key={item.n}>
              <span className={styles.legendBadge}>{item.n}</span>
              <span>
                <RichText text={item.text} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

function IconItem({ item }: { item: GuideIconItem }) {
  const Icon = GUIDE_ICONS[item.icon];
  return (
    <li className={styles.iconItem}>
      <span className={styles.iconBox}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span>
        <strong>{item.label}</strong>
        <span>{item.text}</span>
      </span>
    </li>
  );
}

export function GuideBlockView({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "steps":
      return <Steps steps={block.steps} />;
    case "text":
      return (
        <p className={styles.text}>
          <RichText text={block.text} />
        </p>
      );
    case "heading":
      return <h4 className={styles.subheading}>{block.text}</h4>;
    case "bullets":
      return (
        <ul className={styles.bullets}>
          {block.items.map((item, index) => (
            <li key={index}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "figure":
      return <Figure figure={block.figure} />;
    case "tip":
      return (
        <aside className={styles.tip}>
          <strong>{block.title}:</strong> <RichText text={block.text} />
        </aside>
      );
    case "features":
      return (
        <ul className={styles.features}>
          {block.items.map((item) => (
            <IconItem key={item.label} item={item} />
          ))}
        </ul>
      );
    case "icons":
      return (
        <div className={styles.iconGroups}>
          {block.groups.map((group) => (
            <section key={group.title}>
              <h4 className={styles.subheading}>{group.title}</h4>
              <ul className={styles.iconGrid}>
                {group.items.map((item) => (
                  <IconItem key={item.label} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      );
    case "faq":
      return (
        <dl className={styles.faq}>
          {block.items.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>
                <RichText text={item.a} />
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
