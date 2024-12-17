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
// @version       1.4.1
// @license       MIT
// @downloadURL   https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// @updateURL     https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// ==/UserScript==

const LOCAL_STORAGE_KEY = 'bookmarks';
const LOAD_NEXT_PAGE = 10;
const BOOKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">< !--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/></svg>`;
const BOOKMARK_CLASSNAME = 'bookmarked';
const JUMP_TO_BOOKMARK_BUTTON_ID_NAME = 'jump-to-bookmark';

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

function queryAllModels() {
  return Array.from(document.querySelectorAll('a[href^="/models/"]'));
}

async function findAndMarkBookmarkedModel(bookmarks) {
  await waitForLoadingComplete();
  const models = queryAllModels();
  const bookmarkedModels = models.filter((model) => {
    return bookmarks.some(bookmark => model.href.match(bookmark))
  }).filter(x => !x.innerText.includes('Early Access'));
  const bookmarkedModel = bookmarkedModels.pop() ?? null;
  if (!bookmarkedModel) {
    return [null, models.pop(), models];
  }
  const icon = createBookmarkIcon()
  icon.classList.add('bookmark-icon')

  bookmarkedModel.parentNode.parentNode.appendChild(icon);
  bookmarkedModel.parentNode.parentNode.classList.add(BOOKMARK_CLASSNAME);

  return [bookmarkedModel, null, models];
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

async function initialScrollToTheBookmark(retry = 1, firstThreeModels = null) {
  await waitForLoadingComplete();
  const bookmarks = loadBookmarks();

  if (!bookmarks) {
    await saveBookmark();
    return;
  }

  if (retry > LOAD_NEXT_PAGE) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('could nod find bookmarks')
    await saveBookmark(firstThreeModels);
    return;
  }

  if ($(`.${BOOKMARK_CLASSNAME}`)) {
    $(`.${BOOKMARK_CLASSNAME}`).scrollIntoView({ behavior: 'smooth' });
    return
  }

  const result = await findAndMarkBookmarkedModel(bookmarks);
  const [bookmarkedModel, oldestModel, loadedModels] = result;
  if (!bookmarkedModel) {
    console.info('the bookmarked model is not found in this page', retry);
    oldestModel.scrollIntoView();

    await sleep(1000);
    return await initialScrollToTheBookmark(retry + 1, retry === 1 ? loadedModels.slice(0, 3) : firstThreeModels);
  }

  bookmarkedModel.scrollIntoView({ behavior: 'smooth' });
  activateButton()
  await saveBookmark(firstThreeModels);

  console.info('moved to the last bookmark');

  return;
}

async function saveBookmark(firstThreeModels = null) {
  await waitForLoadingComplete();

  const latestModels = firstThreeModels ? firstThreeModels : queryAllModels().slice(0, 3);
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

  const models = queryAllModels();

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
      if (x.innerText.includes('Early Access')) {
        x.setAttribute('style', 'opacity: 0;')
      }
    })
  }
}

function registerMenuToggleHideEarlyAccess() {
  // 現在のメニューコマンドIDを管理
  let currentCommandId;
  // メニューを更新する関数
  function updateMenu() {
    // 既存のコマンドを削除
    if (currentCommandId) {
      GM_unregisterMenuCommand(currentCommandId);
    }
    // 新しいメニューを登録
    const label = isHideEarlyAccessEnabled ? '☑ hide Early Access' : '□ hide Early Access';
    currentCommandId = GM_registerMenuCommand(label, toggleFeature);
  }
  // トグル機能
  function toggleFeature() {
    isHideEarlyAccessEnabled = !isHideEarlyAccessEnabled;
    GM_setValue("isHideEarlyAccessEnabled", isHideEarlyAccessEnabled); // 状態を保存
    updateMenu(); // メニューを更新
  }
  // 初期化時にメニューを設定
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


