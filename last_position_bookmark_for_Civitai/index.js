// ==UserScript==
// @name        last position bookmark for Civitai
// @namespace   Violentmonkey Scripts
// @match       https://civitai.com/models
// @grant       GM_registerMenuCommand
// @run-at      document-idle
// @version     1.1.0
// @license     MIT
// @updateURL   https://update.greasyfork.org/scripts/505187/last%20position%20bookmark%20for%20Civitai.user.js
// ==/UserScript==

const LOCAL_STORAGE_KEY = 'bookmarks';
const LOAD_NEXT_PAGE = 10;
const BOOKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="tomato"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/></svg>';
const BOOKMARK_CLASSNAME = 'bookmarked';

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
  div.setAttribute('style', "position:absolute; right: 30px; top: -5px; height: 100px; width: 40px; z-index: 999;");
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
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return;
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


  addAttribute(bookmarkedModel, 'style', 'border: 10px solid tomato;')
  bookmarkedModel.appendChild(createBookmarkIcon());
  bookmarkedModel.classList.add(BOOKMARK_CLASSNAME);
  bookmarkedModel.scrollIntoView({ behavior: 'smooth' });

  saveBookmark();
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
  $$(`.${BOOKMARK_CLASSNAME}`)[0].scrollIntoView({ behavior: 'smooth' });
}

async function main() {
  if (! await isSortByNewest()) {
    console.info('this script should run only on newest sort mode');
    return;
  }
  await waitForLoadingComplete();
  await scrollToTheBookmark();

  // register a menu command
  GM_registerMenuCommand('ブックマークまで移動', forceMoveToBookmark);

}

main()


