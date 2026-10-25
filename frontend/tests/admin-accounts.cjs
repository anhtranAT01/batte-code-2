const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('esbuild');

let auth = { user: { id: 'admin', username: 'Admin', role: 'ADMIN' }, getAuthHeaders: () => ({ Authorization: 'Bearer test' }) };
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/AdminDashboardView.jsx'), 'utf8');
const moduleExports = { exports: {} };
new Function('require', 'module', 'exports', transformSync(source, { loader: 'jsx', format: 'cjs' }).code)(
  id => id === '../context/AuthContext' ? { useAuth: () => auth }
    : id === '../lib/publicData' ? {invalidatePublicData() {}} : require(id), moduleExports, moduleExports.exports
);
const Admin = moduleExports.exports.default;
const text = value => Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : String(value ?? '');
const button = (tree, label) => tree.root.findAllByType('button').find(node => text(node.props.children).includes(label));
const users = [
  { id: 'admin', username: 'Admin', role: 'ADMIN', created_at: '2026-10-01' },
  { id: 'student', username: 'Student', role: 'STUDENT', created_at: '2026-10-01' },
];
const calls = [];
global.fetch = async (url, init = {}) => {
  calls.push({ url, init });
  const data = init.method === 'PUT' ? { id: 'student', username: 'StudentRenamed' }
    : url === '/api/admin/users' ? users : [];
  return { ok: true, json: async () => ({ success: true, data, message: 'Đã cập nhật.' }) };
};

async function main() {
  let tree;
  await act(async () => { tree = create(React.createElement(Admin)); });
  assert.deepEqual(calls.map(call => call.url), ['/api/admin/users'], 'Opening the dashboard must not fetch every tab or queue stats');
  assert.equal(tree.root.findByProps({ 'aria-label': 'Quyền của Admin' }).props.disabled, true);
  assert.equal(tree.root.findByProps({ 'aria-label': 'Quyền của Student' }).props.disabled, false);
  await act(async () => { tree.root.findByProps({ 'aria-label': 'Quản lý tài khoản Student' }).props.onClick(); });
  assert.equal(tree.root.findByProps({ id: 'admin-new-password' }).props.type, 'password');
  assert.equal(tree.root.findByProps({ id: 'admin-confirm-password' }).props.type, 'password');
  assert.equal(tree.root.findByProps({ id: 'admin-new-password' }).props.value, '');
  await act(async () => {
    tree.root.findByProps({ id: 'admin-new-password' }).props.onChange({ target: { value: 'new_password' } });
    tree.root.findByProps({ id: 'admin-confirm-password' }).props.onChange({ target: { value: 'mismatch' } });
  });
  await act(async () => { tree.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.length, 1, 'Mismatched passwords must not reach the API');
  assert.ok(text(tree.root.findByProps({ role: 'alert' }).props.children).includes('chưa khớp'));
  await act(async () => { tree.root.findByProps({ id: 'admin-confirm-password' }).props.onChange({ target: { value: 'new_password' } }); });
  await act(async () => { tree.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.at(-1).url, '/api/admin/users/student/password');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { password: 'new_password' });
  assert.equal(tree.root.findAllByProps({ role: 'dialog' }).length, 0);

  await act(async () => { tree.root.findByProps({ 'aria-label': 'Quản lý tài khoản StudentRenamed' }).props.onClick(); });
  assert.equal(tree.root.findByProps({ id: 'admin-new-password' }).props.value, '', 'Reset fields must not retain the previous password');
  await act(async () => { tree.root.findByProps({ id: 'admin-account-name' }).props.onChange({ target: { value: 'AnotherName' } }); });
  await act(async () => { tree.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.at(-1).url, '/api/admin/users/student/account');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { username: 'AnotherName' });
  await act(async () => { button(tree, 'Kho Bot').props.onClick(); });
  assert.equal(calls.at(-1).url, '/api/admin/bots');
  const count = calls.length;
  await act(async () => { button(tree, 'Tài Khoản').props.onClick(); });
  assert.equal(calls.length, count, 'Switching back should reuse the loaded account list');
  act(() => tree.unmount());
  auth = { ...auth, user: { id: 'teacher', role: 'TEACHER' } };
  await act(async () => { tree = create(React.createElement(Admin)); });
  assert.equal(tree.root.findAllByType('select').every(node => node.props.disabled), true);
  assert.equal(tree.root.findAllByProps({ 'aria-label': 'Quản lý tài khoản Student' }).length, 0);
  assert.equal(tree.root.findAllByProps({ 'aria-label': 'Xóa người dùng Student' }).length, 0);
  assert.equal(button(tree,'Trận Đấu'),undefined);
  act(() => tree.unmount());
  console.log('PASS: admin account/reset forms hide credentials, validate confirmation, restrict teacher controls, and fetch tabs on demand');

  auth={...auth,user:{id:'admin',username:'Admin',role:'ADMIN'}};
  let roster=[...users], accepted=false, failDeletion=false, confirmed='';
  let matches=Array.from({length:26},(_,i)=>({id:`match-${i}`,p1_username:'Student',p2_username:'Boss AI',created_at:'2026-10-01'}));
  const deletes=[];
  global.confirm=message=>{confirmed=message;return accepted;};
  global.fetch=async (url,init={})=>{
    if(init.method==='DELETE') {
      deletes.push(url);
      if(failDeletion) return {ok:false,json:async()=>({message:'Không thể xóa lúc này.'})};
      if(url.includes('/users/')) roster=roster.filter(u=>u.id!==url.split('/').at(-1));
      else matches=matches.filter(m=>m.id!==url.split('/').at(-1));
      return {ok:true,json:async()=>({success:true,message:'Đã xóa.'})};
    }
    const offset=Number(new URL(url,'http://test').searchParams.get('offset')||0);
    return {ok:true,json:async()=>({success:true,data:url.includes('/matches?') ? matches.slice(offset,offset+25) : roster,
      pagination:{hasMore:offset+25<matches.length}})};
  };
  await act(async()=>{tree=create(React.createElement(Admin));});
  assert.equal(tree.root.findByProps({'aria-label':'Xóa người dùng Admin'}).props.disabled,true);
  await act(async()=>{await tree.root.findByProps({'aria-label':'Xóa người dùng Student'}).props.onClick();});
  assert.equal(deletes.length,0,'Cancel confirmation must never call DELETE');
  assert.match(confirmed,/Bot.*lịch sử/);
  accepted=true;failDeletion=true;
  await act(async()=>{await tree.root.findByProps({'aria-label':'Xóa người dùng Student'}).props.onClick();});
  assert.equal(tree.root.findAllByProps({'aria-label':'Xóa người dùng Student'}).length,1,'API errors retain the account row');
  failDeletion=false;
  await act(async()=>{await tree.root.findByProps({'aria-label':'Xóa người dùng Student'}).props.onClick();});
  assert.equal(tree.root.findAllByProps({'aria-label':'Xóa người dùng Student'}).length,0);
  await act(async()=>{button(tree,'Trận Đấu').props.onClick();});
  assert.equal(tree.root.findAllByType('button').filter(n=>n.props['aria-label']?.startsWith('Xóa trận ')).length,25);
  await act(async()=>{button(tree,'Trang sau').props.onClick();});
  assert.equal(tree.root.findAllByType('button').filter(n=>n.props['aria-label']?.startsWith('Xóa trận ')).length,1);
  await act(async()=>{await tree.root.findByProps({'aria-label':'Xóa trận match-25'}).props.onClick();});
  assert.equal(deletes.at(-1),'/api/admin/matches/match-25');
  assert.match(confirmed,/Elo.*giữ nguyên/);
  assert.equal(tree.root.findAllByType('button').filter(n=>n.props['aria-label']?.startsWith('Xóa trận ')).length,25,'Deleting the last row on page two returns to page one');
  assert.equal(button(tree,'Trang trước').props.disabled,true);
  act(()=>tree.unmount());
  console.log('PASS: admin-only delete buttons, self protection, confirmation/cancel, API failure, success and paginated match removal');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
