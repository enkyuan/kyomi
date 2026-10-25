"use client";

import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@kyomi/ui/components/preview-card";
import { Fragment, type ReactNode } from "react";
import type { ReaderInline, ReaderInlineFormat } from "../../core/document";
import { getReaderSourceLabel, normalizeSafeHttpUrl } from "../../core/url";
import { useDocumentContext } from "./context";
import { anchorId, footnoteRefId, resolveImage, scrollToAnchor } from "./lib";
import { InlineMath } from "./math";

const FORMAT_TAGS = {
  strong: "strong",
  emphasis: "em",
  underline: "u",
  strike: "s",
  insert: "ins",
  subscript: "sub",
  superscript: "sup",
  highlight: "mark",
  small: "small",
  keyboard: "kbd",
  cite: "cite",
  quote: "q",
} as const satisfies Record<ReaderInlineFormat, keyof React.JSX.IntrinsicElements>;

function ExternalLink({
  href,
  title,
  children,
}: {
  href: string;
  title?: string | undefined;
  children: ReactNode;
}) {
  const { openLinksInNewTab, showLinkPreviews } = useDocumentContext();
  const linkProps = openLinksInNewTab
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};

  if (!showLinkPreviews) {
    return (
      <a href={href} title={title} {...linkProps}>
        {children}
      </a>
    );
  }

  return (
    <PreviewCard>
      <PreviewCardTrigger delay={280} href={href} title={title ?? href} {...linkProps}>
        {children}
      </PreviewCardTrigger>
      <PreviewCardPopup align="start" className="w-72 flex-col gap-1.5 p-3" sideOffset={8}>
        <h4 className="truncate font-medium text-sm">{getReaderSourceLabel(href, href)}</h4>
        <p className="break-all text-muted-foreground text-xs">{href}</p>
      </PreviewCardPopup>
    </PreviewCard>
  );
}

function InlineLink({
  href,
  title,
  children,
}: {
  href: string;
  title?: string | undefined;
  children: ReactNode;
}) {
  if (href.startsWith("#")) {
    const id = anchorId(href.slice(1));
    return (
      <a href={`#${id}`} onClick={(event) => scrollToAnchor(event, id)} title={title}>
        {children}
      </a>
    );
  }

  const safeHref = normalizeSafeHttpUrl(href);
  return safeHref ? (
    <ExternalLink href={safeHref} title={title}>
      {children}
    </ExternalLink>
  ) : (
    <>{children}</>
  );
}

function InlineImage({ image }: { image: Extract<ReaderInline, { type: "image" }>["image"] }) {
  const { transformImageUrl, imageLoading } = useDocumentContext();
  const resolved = resolveImage(image, transformImageUrl);
  if (!resolved) {
    return image.alt ? <>{image.alt}</> : null;
  }
  return (
    <img
      alt={image.alt}
      data-reader-inline-img=""
      decoding="async"
      height={image.height}
      loading={imageLoading}
      src={resolved.src}
      srcSet={resolved.srcSet}
      width={image.width}
    />
  );
}

function InlineNode({ node }: { node: ReaderInline }) {
  switch (node.type) {
    case "text":
      return <>{node.value}</>;
    case "format": {
      const Tag = FORMAT_TAGS[node.format];
      return (
        <Tag>
          <Inlines nodes={node.children} />
        </Tag>
      );
    }
    case "code":
      return <code>{node.value}</code>;
    case "link":
      return (
        <InlineLink href={node.href} title={node.title}>
          <Inlines nodes={node.children} />
        </InlineLink>
      );
    case "abbr":
      return (
        <abbr title={node.title}>
          <Inlines nodes={node.children} />
        </abbr>
      );
    case "break":
      return <br />;
    case "math":
      return <InlineMath math={node} />;
    case "footnoteRef": {
      const target = anchorId(node.id);
      return (
        <sup data-reader-footnote-ref="">
          <a
            aria-label={`Footnote ${node.label}`}
            href={`#${target}`}
            id={footnoteRefId(node.id)}
            onClick={(event) => scrollToAnchor(event, target)}
          >
            {node.label}
          </a>
        </sup>
      );
    }
    case "image":
      return <InlineImage image={node.image} />;
    default:
      return node satisfies never;
  }
}

export function Inlines({ nodes }: { nodes: readonly ReaderInline[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={index}>
          <InlineNode node={node} />
        </Fragment>
      ))}
    </>
  );
}
