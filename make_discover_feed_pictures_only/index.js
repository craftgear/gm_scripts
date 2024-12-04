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

function deleteText() {
  document.querySelectorAll('div[data-testid^=feedItem-by-] *').forEach(x => x.children.length === 0 ? x.innerText = '' : null)
  document.querySelectorAll('div[data-testid^=postText]').forEach(x => x.innerText = '')
}

function main() {
  const observer = new MutationObserver(deleteText);

  observer.observe(document.querySelector('body'), { subtree: true, childList: true })
}

main()
