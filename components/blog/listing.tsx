import Link from 'next/link';
import { rich } from '@/lib/content/rich';
import { blogPageContent } from '@/lib/content/blog';
import { displayDate } from '@/lib/display-date';
import { excerptOf, ghostImageSize, type PostSummary } from '@/lib/blog/ghost';
import { listingPagePath, postPath, tagPath } from '@/lib/blog/links';
import styles from './blog.module.css';

/**
 * The pieces every blog listing shares: the index, a topic, the author page
 * and their numbered pages. All server rendered, with every post and every
 * page reachable as a plain <a>, which is what lets a crawler walk the
 * archive without running the old theme's load-more script.
 */

/** Faint axes and gridlines behind a card with no image: plotting paper, not
 *  a picture. */
function GridLines() {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 180" preserveAspectRatio="none">
      {[36, 72, 108, 144].map((y) => (
        <line
          key={y}
          x1="0"
          x2="320"
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
      ))}
      {[64, 128, 192, 256].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="0"
          y2="180"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
      ))}
    </svg>
  );
}

export function PostCard({ post, priority }: { post: PostSummary; priority?: boolean }) {
  const { labels } = blogPageContent;
  const topic = post.primary_tag?.name;
  return (
    <Link href={postPath(post.slug)} className={`card ${styles.postCard}`}>
      <div className={styles.cardMedia}>
        {post.feature_image ? (
          // Ghost's CDN has a 600px and a 1000px copy of every image; the
          // card is never wider than ~420px on screen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ghostImageSize(post.feature_image, 600)}
            srcSet={`${ghostImageSize(post.feature_image, 600)} 600w, ${ghostImageSize(post.feature_image, 1000)} 1000w`}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 420px"
            alt={post.feature_image_alt || post.title}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div className={styles.cardPlaceholder}>
            <GridLines />
            {topic ? <span className={styles.cardPlaceholderText}>{topic}</span> : null}
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        {topic ? <span className="card__tag">{topic}</span> : null}
        <h3 className={styles.cardTitle}>{post.title}</h3>
        <p className={styles.cardExcerpt}>{excerptOf(post)}</p>
        <span className={styles.cardMeta}>
          <time dateTime={post.published_at}>{displayDate(post.published_at)}</time>
          {' · '}
          {post.reading_time} {labels.readingTimeSuffix}
        </span>
      </div>
    </Link>
  );
}

export function PostGrid({ posts, heading }: { posts: PostSummary[]; heading: string }) {
  return (
    <>
      <h2 className="visually-hidden">{heading}</h2>
      <div className="card-grid">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} priority={i < 3} />
        ))}
      </div>
    </>
  );
}

/** "All posts" and one pill per topic. The current one is marked for
 *  assistive technology as well as by colour. */
export function TopicFilter({
  topics,
  active,
}: {
  topics: { slug: string; name: string; count: number }[];
  active?: string;
}) {
  const { topics: copy } = blogPageContent;
  return (
    <nav aria-label={copy.label}>
      <ul className={styles.topics}>
        <li>
          <Link
            href="/blog/"
            className={styles.topic}
            aria-current={active ? undefined : 'page'}
            data-ck="topics.all"
          >
            {rich(copy.all)}
          </Link>
        </li>
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link
              href={tagPath(topic.slug)}
              className={styles.topic}
              aria-current={active === topic.slug ? 'page' : undefined}
            >
              {topic.name}
              <span className={styles.topicCount}>{topic.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Newer / older, as real links with rel=prev / rel=next. */
export function Pagination({
  base,
  page,
  total,
}: {
  /** The listing's own URL, e.g. "/blog/" or "/blog/tag/case-studies/". */
  base: string;
  page: number;
  total: number;
}) {
  if (total <= 1) return null;
  const { pagination } = blogPageContent;
  return (
    <nav className={styles.pagination} aria-label={pagination.label}>
      <span className={styles.pageStatus}>
        {page} {pagination.pageOf} {total}
      </span>
      <span className={styles.pageLinks}>
        {page > 1 ? (
          <Link href={listingPagePath(base, page - 1)} rel="prev" className="btn-secondary">
            <span data-ck="pagination.newer">{rich(pagination.newer)}</span>
          </Link>
        ) : null}
        {page < total ? (
          <Link href={listingPagePath(base, page + 1)} rel="next" className="btn-primary">
            <span data-ck="pagination.older">{rich(pagination.older)}</span>
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
