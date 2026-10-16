-- Widget display options and Instagram engagement counts for public embeds.

alter table feedflow.widgets
  add column if not exists tile_ratio text not null default 'portrait';

alter table feedflow.widgets
  drop constraint if exists feedflow_widgets_tile_ratio_check;

alter table feedflow.widgets
  add constraint feedflow_widgets_tile_ratio_check
  check (tile_ratio in ('square', 'portrait'));

alter table feedflow.widgets
  add column if not exists play_videos boolean not null default true;

alter table feedflow.widgets
  alter column show_likes set default true;

update feedflow.widgets
set
  tile_ratio = 'portrait',
  play_videos = true,
  show_likes = true
where tile_ratio is distinct from 'portrait'
   or play_videos is distinct from true
   or show_likes is distinct from true;

alter table feedflow.posts
  add column if not exists like_count integer,
  add column if not exists comments_count integer;

alter table feedflow.widgets
  add column if not exists reveal_animation text not null default 'none';

alter table feedflow.widgets
  drop constraint if exists feedflow_widgets_reveal_animation_check;

alter table feedflow.widgets
  add constraint feedflow_widgets_reveal_animation_check
  check (reveal_animation in ('none', 'fade', 'rise', 'cascade', 'scale'));

comment on column feedflow.widgets.tile_ratio is
  'square = 1:1 profile crop, portrait = 4:5 in-feed crop.';
comment on column feedflow.widgets.play_videos is
  'Play the Instagram video file muted while the tile is hovered.';
comment on column feedflow.widgets.reveal_animation is
  'How the embed appears when it scrolls into view: none, fade, rise, cascade, or scale.';
