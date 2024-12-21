// ==UserScript==
// @name          last position bookmark for Civitai
// @namespace     Violentmonkey Scripts
// @match         https://civitai.com/*
// @grant         GM_registerMenuCommand
// @grant         GM_unregisterMenuCommand
// @grant         GM_addStyle
// @grant         GM_getValue
// @grant         GM_setValue
// @run-at        document-idle
// @version       1.5.1
// @license       MIT
// @downloadURL   https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// @updateURL     https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// ==/UserScript==

const LOCAL_STORAGE_KEY = 'bookmarks';
const BOOKMARK_MODEL_SIZE = 5;
const LOAD_NEXT_PAGE = 200;
const BOOKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">< !--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/></svg>`;
const BOOKMARK_CLASSNAME = 'bookmarked';
const JUMP_TO_BOOKMARK_BUTTON_ID_NAME = 'jump-to-bookmark';
const MESSAGE_CONTAINER_CLASSNAME = 'message-container';
const LOOKING_FOR_THE_BOOKMARK = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"> <circle cx="18" cy="12" r="0" fill="currentColor"> <animate attributeName="r" begin=".67" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0" /> </circle> <circle cx="12" cy="12" r="0" fill="currentColor"> <animate attributeName="r" begin=".33" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0" /> </circle> <circle cx="6" cy="12" r="0" fill="currentColor"> <animate attributeName="r" begin="0" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0" /> </circle> </svg>`
const LOOKING_FOR_THE_BOOKMARK_CLASSNAME = 'looking-for-the-bookmark'

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
  border: 6px solid coral !important;
}

.bookmark-icon {
  position:absolute;
  right: 30px;
  top: -5px;
  height: 60px;
  width: 24px;
  color: coral;
  z-index: 9;
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
  animation: 2s ease-in-out infinite pulse ;
}
.scroll-to-bookmark-button.hide {
  display: none;
}


.message-container {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  top: 0;
  left: 0;
  z-index: 1000;
}

.looking-for-the-bookmark {
  position: fixed;
  top: 20px;
  width:auto;
  overflow: hidden;
  color: #EFEFEF;
  background-color: coral;
  transition: all 0.1s ease-out;
  padding: 0.3rem 0.9rem;
  border-radius: 2rem;
  display: flex;
  border: 2px solid #EFEFEF;
  opacity: 1;
}

.looking-for-the-bookmark.opacity0 {
  opacity: 0;
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

async function isSortByNewest() {
  await sleep();
  const divs = Array.from(document.querySelectorAll('div')).filter(x => x.innerText === 'Newest');
  return divs.length > 0;
}

function queryAllModels() {
  return Array.from(document.querySelectorAll('a[href^="/models/"]:not([data-unread])'));
}

function createBookmarkIcon() {
  const div = document.createElement('div');
  div.innerHTML = BOOKMARK_SVG;
  return div;
}

function addLookingForTheBookmarkMessage() {
  const container = document.createElement('div');
  container.classList.add(MESSAGE_CONTAINER_CLASSNAME)
  container.classList.add('hidden')
  const div = document.createElement('div');
  div.classList.add(LOOKING_FOR_THE_BOOKMARK_CLASSNAME)
  div.classList.add('opacity0')
  container.appendChild(div);
  $('body').appendChild(container);
}

function showLookingForTheBookmarkMessage() {
  $(`.${MESSAGE_CONTAINER_CLASSNAME}`).classList.remove('hidden')
  $(`.${LOOKING_FOR_THE_BOOKMARK_CLASSNAME}`).innerHTML = `looking for the last bookmark${LOOKING_FOR_THE_BOOKMARK}`;
  $(`.${LOOKING_FOR_THE_BOOKMARK_CLASSNAME}`).classList.remove('opacity0')
}

function updateLookingForTheBookmarkMessage(pageNumber) {
  $(`.${LOOKING_FOR_THE_BOOKMARK_CLASSNAME}`).innerHTML = `looking for the last bookmark${LOOKING_FOR_THE_BOOKMARK}${pageNumber}`;
}

function hideLookingForTheBookmarkMessage(updateMessage = '') {
  if (updateMessage) {
    $(`.${LOOKING_FOR_THE_BOOKMARK_CLASSNAME}`).innerHTML = updateMessage;
  }
  $(`.${LOOKING_FOR_THE_BOOKMARK_CLASSNAME}`).classList.add('opacity0')
  setTimeout(() => {
    $(`.${MESSAGE_CONTAINER_CLASSNAME}`).classList.add('hidden')
  }, 100)
}

async function findAndMarkBookmarkedModel(bookmarks) {
  await waitForLoadingComplete();
  const models = queryAllModels();
  const bookmarkedModels = models.filter((model) => {
    return bookmarks.some(bookmark => model.href.match(bookmark))
  }).filter(x => !x.innerText.includes('Early Access'));
  const bookmarkedModel = bookmarkedModels.shift() ?? null;
  if (!bookmarkedModel) {
    return [null, models.pop(), models];
  }
  const icon = createBookmarkIcon()
  icon.classList.add('bookmark-icon')

  bookmarkedModel.parentNode.parentNode.appendChild(icon);
  bookmarkedModel.parentNode.parentNode.classList.add(BOOKMARK_CLASSNAME);

  return [bookmarkedModel, null, models.slice(0, BOOKMARK_MODEL_SIZE)];
}

function loadBookmarks() {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
}

function activateButton(retry = 1) {
  if (retry >= 5) {
    console.log('cannot find activate button in 2.5secs')
    return;
  }
  setTimeout(() => {
    if (ifBookmarkIsInView()) {
      return;
    }
    const button = $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`);
    if (!button) {
      activateButton(retry + 1)
      return
    }
    button.classList.add('active')
  }, 500)
}

async function initialScrollToTheBookmark(retry = 1, newestModels = null) {
  await waitForLoadingComplete();
  const bookmarks = loadBookmarks();

  if (!bookmarks) {
    await saveBookmark();
    return;
  }

  showLookingForTheBookmarkMessage()
  updateLookingForTheBookmarkMessage(retry)

  if (retry > LOAD_NEXT_PAGE) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('could nod find bookmarks')
    await saveBookmark(newestModels);
    hideLookingForTheBookmarkMessage('could not find the last bookmark')
    return;
  }

  if ($(`.${BOOKMARK_CLASSNAME}`)) {
    $(`.${BOOKMARK_CLASSNAME}`).scrollIntoView({ behavior: 'smooth' });
    return
  }

  const result = await findAndMarkBookmarkedModel(bookmarks);
  const [bookmarkedModel, oldestModel, _newestModels] = result;
  if (!bookmarkedModel) {
    console.info('the bookmarked model is not found in this page', retry);
    oldestModel.scrollIntoView();

    await sleep(1000);
    return await initialScrollToTheBookmark(retry + 1, retry === 1 ? _newestModels : newestModels);
  }

  hideLookingForTheBookmarkMessage('found the last bookmark')

  bookmarkedModel.scrollIntoView({ behavior: 'smooth' });
  activateButton()
  await saveBookmark(newestModels);

  console.info('moved to the last bookmark');

  return;
}

async function saveBookmark(newestModels = null) {
  await waitForLoadingComplete();

  const modelsForBookmark = newestModels ? newestModels : queryAllModels().slice(0, BOOKMARK_MODEL_SIZE);
  const bookmarks = modelsForBookmark.map(x => {
    const modelId = x?.href?.match(/models\/(\d*)\//)?.at(1) ?? 'none';
    const modelVersionId = x?.href?.match(/\?modelVersionId=(\d*)/)?.at(1) ?? '';
    return `${modelId}.*${modelVersionId}`
  })

  if (bookmarks.length === 0) {
    console.error('there are no models: ', modelsForBookmark);
    return
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
}

async function waitForLoadingComplete(retry = 1) {
  if (retry > 10) {
    console.error('wait for page loading timeout. nothing happened.');
    return;
  }

  await sleep(500);
  const models = queryAllModels();

  if (models.length === 0) {
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
  button.classList.add('hidden')
  button.classList.add('scroll-to-bookmark-button')
  button.innerHTML = `<p>jump to the bookmark</p>`;
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
      if (x.parentNode.innerText.includes('Early Access')) {
        x.parentNode.setAttribute('style', 'opacity: 0;')
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
    const label = isHideEarlyAccessEnabled ? '☑ hide Early Access' : '□ hide Early Access';
    currentCommandId = GM_registerMenuCommand(label, toggleFeature);
  }
  function toggleFeature() {
    isHideEarlyAccessEnabled = !isHideEarlyAccessEnabled;
    GM_setValue("isHideEarlyAccessEnabled", isHideEarlyAccessEnabled); // 状態を保存
    updateMenu();
  }
  updateMenu();
}

let prevLocation = window.location.href;
function observeLocationChange() {
  const observer = new MutationObserver(async () => {
    const currentLocation = window.location.href;
    if (prevLocation !== currentLocation) {
      prevLocation = currentLocation
      if (currentLocation.endsWith('models')) {
        const bookmarks = loadBookmarks();
        await findAndMarkBookmarkedModel(bookmarks)
        $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`).classList.remove('hidden')
      } else {
        $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`).classList.add('hidden')
      }
    }
  })
  observer.observe($('body'), {
    childList: true, subTree: true
  })
}

async function main() {
  observeLocationChange()
  // register a menu command
  registerMenuToggleHideEarlyAccess()
  // add a jump to bookmark button
  addScrollToBookmarkButton();

  addLookingForTheBookmarkMessage();


  if (!window.location.href.endsWith('models')) {
    return;
  }

  if (! await isSortByNewest()) {
    console.info('this script should run only on newest sort mode');
    return;
  }

  $(`#${JUMP_TO_BOOKMARK_BUTTON_ID_NAME}`).classList.remove('hidden')
  await initialScrollToTheBookmark();


  // hide Early Access models
  // FIXME: this works only when the sripts starts on models page
  $('.scroll-area').addEventListener('scrollend', hideEarlyAccess)

}

main()


