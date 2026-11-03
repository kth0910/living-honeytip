// 페이지에 인라인으로 들어가는 작은 스크립트. JS가 꺼져 있어도 서버 렌더링만으로 모든 정보를 볼 수 있다.
export const PRICE_PAGE_SIZE = 20;

export const CLIENT_JS = /* js */ `
(function () {
  // 선택 상자를 바꾸면 바로 적용
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () { el.form && el.form.submit(); });
  });

  // 가격 목록: 종류, 검색어, 정렬, 페이지.
  // 품목은 모두 한 번에 받아 두고 브라우저에서 거르고 정렬하고 잘라서 보여 준다.
  var list = document.getElementById('plist');
  if (!list) return;
  var PAGE = ${PRICE_PAGE_SIZE};
  var rows = Array.prototype.slice.call(list.querySelectorAll('li[data-cat]'));
  var heads = Array.prototype.slice.call(list.querySelectorAll('li.row-head'));
  var original = Array.prototype.slice.call(list.children);
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-cat-chip]'));
  var q = document.getElementById('pq');
  var sort = document.getElementById('psort');
  var count = document.getElementById('pcount');
  var empty = document.getElementById('pempty');
  var pager = document.getElementById('ppager');
  var prev = document.getElementById('pprev');
  var next = document.getElementById('pnext');
  var pos = document.getElementById('ppos');
  var section = document.getElementById('all-h');
  var state = { cat: '', q: '', sort: 'cat', page: 1 };

  function norm(s) { return (s || '').toLowerCase().replace(/\\s+/g, ''); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function sorted(items) {
    if (state.sort === 'cat') return items; // 서버가 종류별로 정렬해 둔 순서
    return items.slice().sort(function (a, b) {
      var s = state.sort;
      if (s === 'name') return a.dataset.name.localeCompare(b.dataset.name, 'ko');
      var key = s === 'cheap' || s === 'pricey' ? 'price' : 'ch';
      var va = num(a.dataset[key]), vb = num(b.dataset[key]);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // 비교할 값이 없는 품목은 뒤로
      if (vb === null) return -1;
      return s === 'drop' || s === 'cheap' ? va - vb : vb - va;
    });
  }

  function apply(scroll) {
    var needle = norm(state.q);
    var matched = rows.filter(function (li) {
      return (!state.cat || li.dataset.cat === state.cat) && (!needle || norm(li.dataset.name).indexOf(needle) >= 0);
    });
    var ordered = sorted(matched);
    var pages = Math.max(1, Math.ceil(ordered.length / PAGE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PAGE;
    var visible = ordered.slice(start, start + PAGE);
    var onPage = new Set(visible);

    // DOM 순서: 종류별이면 원래 순서(종류 제목 포함), 아니면 정렬한 순서
    (state.sort === 'cat' ? original : ordered.concat(heads)).forEach(function (li) { list.appendChild(li); });
    rows.forEach(function (li) { li.classList.toggle('hidden', !onPage.has(li)); });
    var catsOnPage = {};
    visible.forEach(function (li) { catsOnPage[li.dataset.cat] = true; });
    heads.forEach(function (h) { h.classList.toggle('hidden', state.sort !== 'cat' || !catsOnPage[h.dataset.head]); });

    if (count) count.textContent = matched.length + '개';
    if (empty) empty.classList.toggle('hidden', matched.length > 0);
    if (pager) {
      pager.classList.toggle('hidden', pages <= 1);
      pos.textContent = state.page + ' / ' + pages;
      prev.disabled = state.page <= 1;
      next.disabled = state.page >= pages;
    }
    if (scroll && section) section.scrollIntoView({ block: 'start', behavior: 'smooth' });
    try {
      var u = new URL(location.href);
      ['c', 'q', 's', 'pg'].forEach(function (k) { u.searchParams.delete(k); });
      if (state.cat) u.searchParams.set('c', state.cat);
      if (state.q) u.searchParams.set('q', state.q);
      if (state.sort !== 'cat') u.searchParams.set('s', state.sort);
      if (state.page > 1) u.searchParams.set('pg', String(state.page));
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function (ev) {
      ev.preventDefault();
      state.cat = chip.dataset.catChip;
      state.page = 1;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      apply();
    });
  });
  if (q) q.addEventListener('input', function () { state.q = q.value.trim(); state.page = 1; apply(); });
  if (sort) sort.addEventListener('change', function () { state.sort = sort.value; state.page = 1; apply(); });
  if (prev) prev.addEventListener('click', function () { state.page--; apply(true); });
  if (next) next.addEventListener('click', function () { state.page++; apply(true); });

  // 서버가 넣어 준 초기값 (주소의 c, q, s, pg)
  state.cat = list.dataset.cat || '';
  state.q = (q && q.value) || '';
  state.sort = (sort && sort.value) || 'cat';
  state.page = parseInt(list.dataset.page || '1', 10) || 1;
  chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.catChip === state.cat)); });
  apply();
})();
`;
