// ==UserScript==
// @name          last position bookmark for Civitai
// @namespace     Violentmonkey Scripts
// @match         https://civitai.com/models
// @grant         GM_registerMenuCommand
// @grant         GM_unregisterMenuCommand
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
// @run-at        document-idle
// @version       1.2.5
// @license       MIT
// @downloadURL   https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// @updateURL     https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// ==/UserScript==

const LOCAL_STORAGE_KEY = 'bookmarks';
const LOAD_NEXT_PAGE = 10;
const BOOKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/></svg>';
const BOOKMARK_CLASSNAME = 'bookmarked';
const JUMP_TO_BOOKMARK_BUTTON_ID_NAME = 'jump-to-bookmark';

// トグル状態を保存する変数（デフォルト: false）
let isHideEarlyAccessEnabled = GM_getValue("isHideEarlyAccessEnabled", false);

GM_addStyle(`
@keyframes pulse {
  0% {
    background-color: gold;
    opacity: 1;
  }
  50% {
    background-color: coral;
    opacity: 1;
  }
  100% {
    background-color: gold;
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
  gap: 1rem;
  align-items: center;
  position: fixed;
  bottom: 40px;
  right: -14rem;
  color: #EFEFEF;
  background-color: coral;
  padding: 0.5rem 2.5rem 0.5rem 0.8rem;
  border-radius: 2rem;
  border: 2px solid #EFEFEF;
  z-index: 100;
  transition: all 0.1s ease-out;
}
.scroll-to-bookmark-button:hover {
  right: -1.5rem;
}
.scroll-to-bookmark-button.active {
  right: -1.5rem;
  animation: 3s ease-in-out infinite pulse ;
}
`)

'use strict;'

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
  return Array.from(document.querySelectorAll('a[href^="/models/"]'));
}

async function initialScrollToTheBookmark(retry = 1) {
  const bookmarks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));

  if (!bookmarks) {
    saveBookmark();
    return;
  }

  if (retry > LOAD_NEXT_PAGE) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return;
  }

  if ($(`.${BOOKMARK_CLASSNAME}`)) {
    $(`.${BOOKMARK_CLASSNAME}`).scrollIntoView({ behavior: 'smooth' });
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
    return await initialScrollToTheBookmark(retry + 1);
  }


  const icon = createBookmarkIcon()
  icon.classList.add('bookmark-icon')

  bookmarkedModel.classList.add('bookmarked')
  bookmarkedModel.appendChild(icon);
  bookmarkedModel.classList.add(BOOKMARK_CLASSNAME);
  bookmarkedModel.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => {
    if (!ifBookmarkIsInView()) {
      const button = $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`);
      button?.classList.add('active')
    }
  }, 500)

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

function addScrollToBookmarkButton() {
  if ($(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`)) {
    return;
  }

  const icon = createBookmarkIcon();
  icon.setAttribute('style', 'width: 12px;')

  const button = document.createElement('button');
  button.id = JUMP_TO_BOOKMARK_BUTTON_ID_NAME;
  button.classList.add('scroll-to-bookmark-button')
  button.innerHTML = `<p>jump to bookmark</p>`;
  button.prepend(icon)
  button.addEventListener('click', () => {
    button.classList.remove('active')
    forceMoveToBookmark();
  });

  $('body').appendChild(button);
}

function ifBookmarkIsInView() {
  const bookmarkedElement = $(`.${BOOKMARK_CLASSNAME}`);
  if (!bookmarkedElement) {
    return false;
  }

  const innerHeight = window.innerHeight;
  const { top, bottom } = bookmarkedElement.getBoundingClientRect();

  if ((top >= 0 && top <= innerHeight) || (bottom >= 0 && bottom <= innerHeight)) {
    return true;
  }

  return false;
}

function hideEarlyAccess() {
  if (isHideEarlyAccessEnabled) {
    $$('a[href^="/models/"]').forEach(x => {
      if (x.innerText.includes('Early Access')) {
        x.setAttribute('style', 'display: none;')
      }
    })
  }
}

function registerMenuToggleHideEarlyAccess() {
  let currentCommandId;
  function updateMenu() {
    if (currentCommandId) {
      GM_unregisterMenuCommand(currentCommandId);
    }
    const label = isHideEarlyAccessEnabled ? '☑ hide Early Access' : "□ hide Early Access";
    currentCommandId = GM_registerMenuCommand(label, toggleHideEarlyAccess);
  }
  function toggleHideEarlyAccess() {
    isHideEarlyAccessEnabled = !isHideEarlyAccessEnabled;
    GM_setValue("isHideEarlyAccessEnabled", isHideEarlyAccessEnabled);
    updateMenu();
  }
  updateMenu();
}

async function main() {
  if (! await isSortByNewest()) {
    console.info('this script should run only on newest sort mode');
    return;
  }
  await waitForLoadingComplete();
  await initialScrollToTheBookmark();

  saveBookmark();

  // add a jump to bookmark button
  addScrollToBookmarkButton();
  // register a menu command
  registerMenuToggleHideEarlyAccess()
  // hide Early Access models
  $('.scroll-area').addEventListener('scrollend', hideEarlyAccess)
}

main()
