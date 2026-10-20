import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInviteLink,inviteFromLink,inviteFromSearch} from '../../web/src/lib/invites.js';

test('personal invite links open the public entrance and round-trip their identifier',()=>{
 for(const origin of ['http://localhost:5173','https://herobits.example']){
  const link=createInviteLink(origin,'aBcD1234');
  assert.equal(link,origin+'/auth?invite=aBcD1234');
  assert.equal(inviteFromLink(link),'aBcD1234');
  assert.equal(inviteFromSearch(new URL(link).search),'aBcD1234');
 }
});
test('shared links accept whitespace and existing /invites links',()=>{
 assert.equal(inviteFromLink('  https://herobits.example/auth?invite=ABC12345  '),'ABC12345');
 assert.equal(inviteFromLink('https://herobits.example/invites?invite=ABC12345'),'ABC12345');
 assert.equal(inviteFromLink('https://herobits.example/auth/?invite=ABC12345'),'ABC12345');
});
test('incomplete, ambiguous or unrelated links cannot be redeemed',()=>{
 for(const link of ['ABC12345','not a link','https://herobits.example/auth','https://herobits.example/auth?invite=abc','https://herobits.example/auth?invite='+ 'a'.repeat(65),'https://herobits.example/auth?invite=ABCD&invite=EFGH','https://herobits.example/auth?invite=AB%2FCD','https://herobits.example/other?invite=ABCD','javascript:alert(1)','ftp://herobits.example/auth?invite=ABCD','https://user:password@herobits.example/auth?invite=ABCD'])assert.equal(inviteFromLink(link),null,link);
});
test('public entry only captures a single valid invitation for the login redirect',()=>{
 assert.equal(inviteFromSearch('?other=1&invite=ABCD1234'),'ABCD1234');
 for(const search of ['', '?invite=', '?invite=ABCD&invite=EFGH', '?invite=%3Cscript%3E'])assert.equal(inviteFromSearch(search),null);
});
