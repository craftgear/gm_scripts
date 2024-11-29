// ==UserScript==
// @name        last position bookmark for Civitai
// @namespace   Violentmonkey Scripts
// @match       https://civitai.com/models
// @grant       GM_registerMenuCommand
// @grant       GM_addStyle
// @run-at      document-idle
// @version     1.2.0
// @license     MIT
// @updateURL   https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// ==/UserScript==

const LOCAL_STORAGE_KEY = 'bookmarks';
const LOAD_NEXT_PAGE = 10;
const BOOKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/></svg>';
const BOOKMARK_CLASSNAME = 'bookmarked';
const JUMP_TO_BOOKMARK_BUTTON_ID_NAME = 'jump-to-bookmark';

let isJumpToBookmarkButtonAlreadyShowed = false;

GM_addStyle(`
@keyframes fadein {
  0% {
    background-color: gold;
    opacity: 0;
  }
  100% {
    background-color: coral;
    opacity: 1;
  }
}

.bookmarked {
  border: 6px solid coral;
}

.bookmark-icon {
  position:absolute;
  right: 30px;
  top: -5px;
  height: 60px;
  width: 24px;
  color: coral;
  z-index: 999;
}

.scroll-to-bookmark-button {
  display: flex;
  gap: 0.2rem;
  align-items: center;
  position: fixed;
  bottom: 30px;
  right: 60px;
  color: #EFEFEF; 
  background-color: coral;
  padding: 0.5rem 0.65rem;
  border-radius: 2rem;
  border: 3px solid #EFEFEF;
  animation: 0.2s ease-in-out 1 fadein;
  z-index: 100;
}`)

function $(selector) {
  return document.querySelector(selector)
}

function $$(selector) {
  return document.querySelectorAll(selector)
}

function sleep(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  })
}

function addAttribute(elem, key, value) {
  const oldValues = elem.getAttribute(key);
  elem.setAttribute(key, `${oldValues} ${value}`);
}

function createBookmarkIcon() {
  const div = document.createElement('div');
  div.innerHTML = BOOKMARK_SVG;
  return div;
}

async function isSortByNewest() {
  await sleep();
  const divs = Array.from(document.querySelectorAll('div')).filter(x => x.innerText === 'Newest');
  return divs.length > 0;
}

function getModels() {
  return Array.from(document.querySelectorAll('a[href^="/models/"]')).filter(x => !x.innerText.includes('Early Access'));
}

async function scrollToTheBookmark(retry = 1) {
  const bookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));

  if (!bookmarks) {
    saveBookmark();
    return;
  }

  if (retry > LOAD_NEXT_PAGE) {
    console.info('bookmarked models are NOT found.')
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return;
  }

  if ($(`.${BOOKMARK_CLASSNAME}`)) {
    forceMoveToBookmark()
    return
  }

  const models = getModels();
  const bookmarkedModels = models.filter((model) => {
    return bookmarks.some(bookmark => model.href.match(bookmark))
  });
  const bookmarkedModel = bookmarkedModels.pop() ?? null;

  if (!bookmarkedModel) {
    console.info('the bookmarked model is not found in this page', retry);
    const oldestModel = models.pop();
    oldestModel.scrollIntoView();

    await sleep(1000);
    return await scrollToTheBookmark(retry + 1);
  }


  const icon = createBookmarkIcon()
  icon.classList.add('bookmark-icon')

  bookmarkedModel.classList.add('bookmarked')
  bookmarkedModel.appendChild(icon);
  bookmarkedModel.classList.add(BOOKMARK_CLASSNAME);
  bookmarkedModel.scrollIntoView({ behavior: 'smooth' });

  console.info('moved to the last bookmark');

  return;
}

function saveBookmark() {
  const latestModels = getModels().slice(0, 3);
  const bookmarks = latestModels.map(x => {
    const modelId = x?.href?.match(/models\/(\d*)\//)?.at(1) ?? 'none';
    const modelVersionId = x?.href?.match(/\?modelVersionId=(\d*)/)?.at(1) ?? '';
    return `${modelId}.*${modelVersionId}`
  })

  if (bookmarks.length === 0 || bookmarks.some(x => x.includes('none'))) {
    console.error('there is no model: ', latestModels);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
}

async function waitForLoadingComplete(retry = 1) {
  if (retry > 10) {
    console.error('cannot find models');
    return;
  }

  const models = getModels();

  if (models.length === 0) {
    await sleep();
    return waitForLoadingComplete(retry + 1);
  }
}

function forceMoveToBookmark() {
  $(`.${BOOKMARK_CLASSNAME}`).scrollIntoView({ behavior: 'smooth' });
}

function hideScrollToBookmarkButton() {
  const button = $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`);
  if (ifBookmarkIsInView() && button) {
    button.remove();
  }
}

function showScrollToBookmarkButton() {
  if (ifBookmarkIsInView()) {
    return;
  }
  if ($(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`)) {
    return;
  }

  const icon = createBookmarkIcon();
  icon.setAttribute('style', 'width: 12px;')

  const button = document.createElement('button');
  button.id = JUMP_TO_BOOKMARK_BUTTON_ID_NAME;
  button.classList.add('scroll-to-bookmark-button')
  if (!isJumpToBookmarkButtonAlreadyShowed) {
    button.innerHTML = `<p>ブックマークまで移動</p>`;
  }
  button.prepend(icon)
  button.addEventListener('click', () => {
    forceMoveToBookmark();
    button.remove();
  });

  isJumpToBookmarkButtonAlreadyShowed = true;
  $('body').appendChild(button);
}

function ifBookmarkIsInView() {
  const bookmarkedModel = $(`.${BOOKMARK_CLASSNAME}`);
  if (!bookmarkedModel) {
    return false;
  }

  const innerHeight = window.innerHeight;
  const { top, bottom } = bookmarkedElement.getBoundingClientRect();

  if ((top >= 0 && top <= innerHeight) || (bottom >= 0 && bottom <= innerHeight)) {
    return true;
  }

  return false;
}


async function main() {
  if (! await isSortByNewest()) {
    console.info('this script should run only on newest sort mode');
    return;
  }
  await waitForLoadingComplete();
  await scrollToTheBookmark();
  saveBookmark();

  // register a menu command
  GM_registerMenuCommand('ブックマークまで移動', forceMoveToBookmark);
  // add a jump to bookmark button
  window.addEventListener('focus', showScrollToBookmarkButton)

  if (ifBookmarkIsInView()) {
    isJumpToBookmarkButtonAlreadyShowed = true
  }
}

main()


