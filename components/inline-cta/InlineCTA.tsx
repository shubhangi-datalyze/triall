import styles from './InlineCTA.module.css';

type Props = {
  href: string;
  heading: string;
  buttonLabel: string;
  /** Content keys, so the /admin preview can find and rewrite this copy. */
  ckHeading?: string;
  ckButtonLabel?: string;
};

export function InlineCTA({
  href,
  heading,
  buttonLabel,
  ckHeading,
  ckButtonLabel,
}: Props) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.heading} data-ck={ckHeading}>
        {heading}
      </p>
      <a href={href} className={styles.button}>
        <span data-ck={ckButtonLabel}>{buttonLabel}</span>
        <span className={styles.arrow} aria-hidden="true">→</span>
      </a>
    </div>
  );
}
