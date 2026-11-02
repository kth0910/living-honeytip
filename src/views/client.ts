// 페이지에 인라인으로 들어가는 작은 스크립트. JS가 꺼져 있어도 서버 렌더링만으로 모든 정보를 볼 수 있다.
export const CLIENT_JS = /* js */ `
(function () {
  // 선택 상자를 바꾸면 바로 적용
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () { el.form && el.form.submit(); });
  });

  // 가격 목록: 부류 · 검색어 · 정렬
  var list = document.getElementById('plist');
  if (!list) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('li[data-cat]'));
  var heads = Array.prototype.slice.call(list.querySelectorAll('li.cat-head'));
  var original = Array.prototype.slice.call(list.children);
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-cat-chip]'));
  var q = document.getElementById('pq');
  var sort = document.getElementById('psort');
  var count = document.getElementById('pcount');
  var empty = document.getElementById('pempty');
  var state = { cat: '', q: '', sort: 'cat' };

  function norm(s) { return (s || '').toLowerCase().replace(/\\s+/g, ''); }

  function apply() {
    var shown = 0;
    var needle = norm(state.q);
    rows.forEach(function (li) {
      var ok = (!state.cat || li.dataset.cat === state.cat) && (!needle || norm(li.dataset.name).indexOf(needle) >= 0);
      li.classList.toggle('hidden', !ok);
      if (ok) shown++;
    });
    var order;
    if (state.sort === 'cat') {
      order = original;
    } else {
      order = rows.slice().sort(function (a, b) {
        var ca = parseFloat(a.dataset.ch), cb = parseFloat(b.dataset.ch);
        if (state.sort === 'name') return a.dataset.name.localeCompare(b.dataset.name, 'ko');
        if (isNaN(ca)) return 1;
        if (isNaN(cb)) return -1;
        return state.sort === 'drop' ? ca - cb : cb - ca;
      });
    }
    order.forEach(function (li) { list.appendChild(li); });
    heads.forEach(function (h) {
      var hasRow = state.sort === 'cat' && rows.some(function (li) { return li.dataset.cat === h.dataset.head && !li.classList.contains('hidden'); });
      h.classList.toggle('hidden', !hasRow);
    });
    if (count) count.textContent = shown + '개 품목';
    if (empty) empty.classList.toggle('hidden', shown > 0);
    try {
      var u = new URL(location.href);
      ['c', 'q', 's'].forEach(function (k) { u.searchParams.delete(k); });
      if (state.cat) u.searchParams.set('c', state.cat);
      if (state.q) u.searchParams.set('q', state.q);
      if (state.sort !== 'cat') u.searchParams.set('s', state.sort);
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function (ev) {
      ev.preventDefault();
      state.cat = chip.dataset.catChip;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      apply();
    });
  });
  if (q) q.addEventListener('input', function () { state.q = q.value.trim(); apply(); });
  if (sort) sort.addEventListener('change', function () { state.sort = sort.value; apply(); });

  // 서버가 넣어 준 초기값
  var init = list.dataset;
  state.cat = init.cat || '';
  state.q = (q && q.value) || '';
  state.sort = (sort && sort.value) || 'cat';
  chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.catChip === state.cat)); });
  apply();
})();
`;
