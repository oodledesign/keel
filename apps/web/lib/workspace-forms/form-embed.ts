import { OZER_LISTING_ID_META_KEY } from '~/lib/commercial/property-hive-custom-fields';

export type FormEmbedListingBind = {
  bindsListing: boolean;
  listingId: string | null;
};

export function publicFormPath(shareToken: string, publicPathTemplate: string) {
  return publicPathTemplate.replace('[token]', shareToken);
}

export function publicFormUrl(origin: string, publicPath: string) {
  return `${origin}${publicPath}`;
}

export function formUrlWithListing(
  publicUrl: string,
  bind: FormEmbedListingBind,
): string {
  if (!bind.bindsListing) return publicUrl;
  return `${publicUrl}?listing=${bind.listingId || 'LISTING_ID'}`;
}

export function formEmbedUrl(
  publicUrl: string,
  bind: FormEmbedListingBind,
  options?: { embed?: boolean },
): string {
  const params = new URLSearchParams();
  if (options?.embed) params.set('embed', '1');
  if (bind.bindsListing) {
    params.set('listing', bind.listingId || 'LISTING_ID');
  }
  const query = params.toString();
  return query ? `${publicUrl}?${query}` : publicUrl;
}

export function buildInlineIframeSnippet(listingUrl: string): string {
  return `<iframe src="${listingUrl}" title="Enquiry form" style="width:100%;min-height:720px;border:0;"></iframe>`;
}

export function buildInlineScriptSnippet(input: {
  shareToken: string;
  publicUrl: string;
  bind: FormEmbedListingBind;
}): string {
  const { shareToken, publicUrl, bind } = input;
  return [
    `<div data-ozer-form="${shareToken}"${
      bind.bindsListing
        ? ` data-listing="${bind.listingId || 'LISTING_ID'}"`
        : ''
    }></div>`,
    `<script>`,
    `(function(){`,
    `  var el=document.querySelector('[data-ozer-form="${shareToken}"]');`,
    `  if(!el||el.querySelector('iframe')) return;`,
    `  var listing=el.getAttribute('data-listing')||'';`,
    `  var iframe=document.createElement('iframe');`,
    `  iframe.src='${publicUrl}'+(listing?'?listing='+encodeURIComponent(listing):'');`,
    `  iframe.style='width:100%;min-height:720px;border:0;';`,
    `  iframe.title='Enquiry form';`,
    `  el.appendChild(iframe);`,
    `})();`,
    `</script>`,
  ].join('\n');
}

export function buildPopupEmbedSnippet(input: {
  shareToken: string;
  publicUrl: string;
  bind: FormEmbedListingBind;
  buttonLabel?: string;
}): string {
  const { shareToken, publicUrl, bind } = input;
  const buttonLabel = input.buttonLabel?.trim() || 'Open form';
  const listingAttr = bind.bindsListing
    ? ` data-listing="${bind.listingId || 'LISTING_ID'}"`
    : '';
  const embedSrc = formEmbedUrl(
    publicUrl,
    { bindsListing: false, listingId: null },
    { embed: true },
  );

  return [
    `<button type="button" data-ozer-form-popup="${shareToken}"${listingAttr}>${buttonLabel}</button>`,
    `<script>`,
    `(function(){`,
    `  var token=${JSON.stringify(shareToken)};`,
    `  var base=${JSON.stringify(embedSrc)};`,
    `  function close(){`,
    `    var overlay=document.querySelector('[data-ozer-form-overlay="'+token+'"]');`,
    `    if(overlay) overlay.remove();`,
    `    document.removeEventListener('keydown', onKey);`,
    `  }`,
    `  function onKey(e){ if(e.key==='Escape') close(); }`,
    `  function open(){`,
    `    if(document.querySelector('[data-ozer-form-overlay="'+token+'"]')) return;`,
    `    var trigger=document.querySelector('[data-ozer-form-popup="'+token+'"]');`,
    `    var listing=(trigger && trigger.getAttribute('data-listing'))||'';`,
    `    var src=base+(listing?(base.indexOf('?')>=0?'&':'?')+'listing='+encodeURIComponent(listing):'');`,
    `    var overlay=document.createElement('div');`,
    `    overlay.setAttribute('data-ozer-form-overlay', token);`,
    `    overlay.setAttribute('style','position:fixed;inset:0;z-index:2147483646;background:rgba(42,23,32,.55);display:flex;align-items:center;justify-content:center;padding:24px;');`,
    `    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });`,
    `    var panel=document.createElement('div');`,
    `    panel.setAttribute('style','position:relative;width:min(720px,100%);height:min(80vh,840px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.25);');`,
    `    var closeBtn=document.createElement('button');`,
    `    closeBtn.type='button';`,
    `    closeBtn.setAttribute('aria-label','Close');`,
    `    closeBtn.textContent='\\u00d7';`,
    `    closeBtn.setAttribute('style','position:absolute;top:8px;right:10px;z-index:1;border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;');`,
    `    closeBtn.addEventListener('click', close);`,
    `    var iframe=document.createElement('iframe');`,
    `    iframe.src=src;`,
    `    iframe.title='Form';`,
    `    iframe.setAttribute('style','width:100%;height:100%;border:0;');`,
    `    panel.appendChild(closeBtn);`,
    `    panel.appendChild(iframe);`,
    `    overlay.appendChild(panel);`,
    `    document.body.appendChild(overlay);`,
    `    document.addEventListener('keydown', onKey);`,
    `  }`,
    `  document.querySelectorAll('[data-ozer-form-popup="'+token+'"]').forEach(function(el){`,
    `    if(el.getAttribute('data-ozer-form-bound')==='1') return;`,
    `    el.setAttribute('data-ozer-form-bound','1');`,
    `    el.addEventListener('click', open);`,
    `  });`,
    `})();`,
    `</script>`,
  ].join('\n');
}

export function buildPropertyHiveSnippet(publicUrl: string): string {
  return [
    `<?php`,
    `// Single property template — meta key ${OZER_LISTING_ID_META_KEY} from the Ozer Property Hive feed.`,
    `$ozer_listing_id = get_post_meta( get_the_ID(), '${OZER_LISTING_ID_META_KEY}', true );`,
    `?>`,
    `<iframe src="${publicUrl}?listing=<?php echo rawurlencode( $ozer_listing_id ); ?>" title="Ozer form" style="width:100%;min-height:720px;border:0;"></iframe>`,
  ].join('\n');
}
