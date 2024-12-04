// ==UserScript==
// @name        make Discover feed (almost) images only
// @namespace   Violentmonkey Scripts
// @match       https://bsky.app/profile/bsky.app/feed/whats-hot
// @run-at      document-end
// @grant       none
// @version     1.0
// @author      -
// @description 2024/12/4 13:35:10
// ==/UserScript==

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => document.querySelectorAll(selector)

function deleteText() {
  if ($('div[style="border-bottom-color: rgb(32, 139, 254);"]').innerText.includes('Discover')) {
    $$('div[data-testid^=feedItem-by-] *').forEach(x => {
      x.children.length === 0 ? x.innerText = '' : null;
    })
    $$('div[data-testid^=postText]').forEach(x => x.innerText = '')
    $$('div[style*="https://cdn.bsky.app/img/avatar_thumbnail/plain/"]').forEach(x => x.remove())
  };
}

function main() {
  const observer = new MutationObserver(deleteText);

  observer.observe($('body'), { subtree: true, childList: true })
}

main()
