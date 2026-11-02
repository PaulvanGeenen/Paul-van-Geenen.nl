/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  order: number;
  teaser: string;
  description: string | string[];
  coverUrl: string;
  bannerUrl?: string;
  buyUrl: string;
  fragmentUrl?: string;
  fragmentText?: string;
  fragmentVideoUrl?: string;
  whyThisOrder: string;
  hasMRI?: boolean;
}

export interface EchoChapter {
  id: string;
  slug: string;
  title: string;
  teaser: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  quote: string;
  backgroundStory: string | string[]; // Array for paragraphs or inline content
  isLocked?: boolean;
  unlockCode?: string;
}
