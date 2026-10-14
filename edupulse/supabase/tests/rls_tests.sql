-- RLS / constraint / RPC tests. Run after migrations 001-003 + stub. Every check raises on failure.
\set ON_ERROR_STOP on
\set QUIET on

-- seed users (as superuser; trigger creates profiles)
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','alex@t.lk','{"full_name":"Alex Perera","role":"student"}'),
 ('00000000-0000-0000-0000-0000000000a2','nim@t.lk','{"full_name":"Nimali Silva","role":"student"}'),
 ('00000000-0000-0000-0000-0000000000b1','sarah@t.lk','{"full_name":"Sarah Fernando","role":"mentor"}'),
 ('00000000-0000-0000-0000-0000000000b2','new@t.lk','{"full_name":"Pending Mentor","role":"mentor"}'),
 ('00000000-0000-0000-0000-0000000000c1','evil@t.lk','{"full_name":"Evil Admin","role":"admin"}'),
 ('00000000-0000-0000-0000-0000000000d1','admin@t.lk','{"full_name":"Admin User","role":"student"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000d1'; -- controlled process (FR-01.6)
delete from public.student_profiles where id='00000000-0000-0000-0000-0000000000d1';
-- make Sarah a complete, approved mentor
update public.mentor_profiles set headline='Senior Engineer', skills='{React,Node}', approval_status='approved',
  category_id=(select id from public.categories where name='Software Engineering')
 where id='00000000-0000-0000-0000-0000000000b1';

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); end $$;

do $$ begin
  assert (select role from public.profiles where id='00000000-0000-0000-0000-0000000000c1')='student',
    'T01 signup with role=admin must become student';
  assert (select count(*) from public.student_profiles)=3, 'T02 student_profiles rows (a1,a2,c1)';
  assert (select count(*) from public.mentor_profiles)=2, 'T03 mentor_profiles rows';
end $$;

-- ===== as student Alex
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$
declare v_id uuid; v_cnt int; v_err text;
begin
  assert (select count(*) from public.mentor_directory)=1, 'T04 directory lists only approved+complete mentor';
  assert (select count(*) from public.mentor_profiles where id='00000000-0000-0000-0000-0000000000b2')=0, 'T05 pending mentor profile hidden from student';

  v_id := public.send_connection_request('00000000-0000-0000-0000-0000000000b1','Hi!');
  assert v_id is not null, 'T06 send request';

  begin perform public.send_connection_request('00000000-0000-0000-0000-0000000000b1','again'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%already sent%', 'T07 duplicate pending blocked: '||coalesce(v_err,'no error');

  begin perform public.send_connection_request('00000000-0000-0000-0000-0000000000b2','x'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%not available%', 'T08 unapproved mentor cannot be requested: '||coalesce(v_err,'no error');

  begin perform public.send_connection_request('00000000-0000-0000-0000-0000000000b1', repeat('x',301)); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err is not null, 'T09 301-char message rejected';

  -- cannot self-accept / cannot insert directly
  begin insert into public.connections(student_id,mentor_id,status) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2','accepted'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%permission denied%', 'T10 direct insert on connections denied: '||coalesce(v_err,'no error');

  begin perform public.respond_connection(v_id, true); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%already answered%', 'T11 student cannot accept own request';

  -- messaging blocked while pending
  begin insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000a1','hello'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%row-level security%', 'T12 message on pending connection blocked: '||coalesce(v_err,'no error');

  -- role escalation attempts
  begin update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1'; v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%permission denied%', 'T13 cannot change own role: '||coalesce(v_err,'no error');

  -- admin RPC denied
  begin perform public.admin_review_mentor('00000000-0000-0000-0000-0000000000b2','approved'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%Not allowed%', 'T14 student cannot approve mentors';
  begin perform * from public.admin_list_users(''); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%Not allowed%', 'T15 student cannot list users';

  -- profile edit: own ok, other blocked (0 rows)
  update public.student_profiles set institution='UoM' where id='00000000-0000-0000-0000-0000000000a1';
  get diagnostics v_cnt = row_count; assert v_cnt=1, 'T16 own profile update';
  update public.student_profiles set institution='HACK' where id='00000000-0000-0000-0000-0000000000a2';
  get diagnostics v_cnt = row_count; assert v_cnt=0, 'T17 other student profile update blocked';
end $$;

-- ===== as mentor Sarah
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$
declare v_id uuid; v_err text; v_cnt int;
begin
  select id into v_id from public.connections where mentor_id='00000000-0000-0000-0000-0000000000b1';
  assert v_id is not null, 'T18 mentor sees incoming request';
  assert (select count(*) from public.student_profiles where id='00000000-0000-0000-0000-0000000000a1')=1, 'T19 mentor sees requesting student profile';
  assert (select count(*) from public.student_profiles where id='00000000-0000-0000-0000-0000000000a2')=0, 'T20 mentor cannot see unrelated student profile';
  assert (select count(*) from public.mentor_directory where id <> auth.uid())=0, 'T21 mentors cannot see other mentors via directory';

  perform public.respond_connection(v_id, true);
  assert (select status from public.connections where id=v_id)='accepted', 'T22 accept works';
  begin perform public.respond_connection(v_id, false); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%already answered%', 'T23 cannot answer twice';

  -- slots
  insert into public.availability_slots(mentor_id,starts_at,ends_at) values ('00000000-0000-0000-0000-0000000000b1', now()+interval '1 day', now()+interval '1 day 1 hour');
  begin insert into public.availability_slots(mentor_id,starts_at,ends_at) values ('00000000-0000-0000-0000-0000000000b1', now()+interval '1 day 30 minutes', now()+interval '1 day 90 minutes'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%slots_no_overlap%', 'T24 overlap rejected: '||coalesce(v_err,'no error');
  begin insert into public.availability_slots(mentor_id,starts_at,ends_at) values ('00000000-0000-0000-0000-0000000000b1', now()-interval '1 day', now()-interval '1 day'+interval '1 hour'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%future%', 'T25 past slot rejected';
  begin insert into public.availability_slots(mentor_id,starts_at,ends_at) values ('00000000-0000-0000-0000-0000000000b1', now()+interval '3 day', now()+interval '3 day 3 hours'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%check%', 'T26 >120 min slot rejected';
  begin insert into public.availability_slots(mentor_id,starts_at,ends_at) values ('00000000-0000-0000-0000-0000000000a1', now()+interval '5 day', now()+interval '5 day 1 hour'); v_err:=null;
  exception when others then v_err:=sqlerrm; end;
  assert v_err like '%row-level security%', 'T27 cannot create slot for another user';

  -- chat
  insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000b1','Welcome Alex!');
  begin insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000b1','   '); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%check%', 'T28 blank message rejected';
  begin insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000b1',repeat('a',1001)); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%check%', 'T29 >1000 char message rejected';
  begin insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000a1','spoof'); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%row-level security%', 'T30 cannot spoof sender';
  begin update public.mentor_profiles set approval_status='approved' where id='00000000-0000-0000-0000-0000000000b2'; v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%permission denied%', 'T31 mentor cannot edit approval_status';
end $$;

-- ===== as student Alex again (connected)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$
declare v_id uuid; v_cnt int;
begin
  select id into v_id from public.connections where student_id='00000000-0000-0000-0000-0000000000a1';
  assert (select count(*) from public.availability_slots)=1, 'T32 connected student sees open slot';
  assert (select count(*) from public.messages where connection_id=v_id)=1, 'T33 student reads mentor message';
  insert into public.messages(connection_id,sender_id,body) values (v_id,'00000000-0000-0000-0000-0000000000a1','Thanks!');
  perform public.mark_conversation_read(v_id);
  assert (select read_at from public.messages where body='Welcome Alex!') is not null, 'T34 mark read';
end $$;

-- ===== as unrelated student Nimali
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$
begin
  assert (select count(*) from public.messages)=0, 'T35 unrelated student cannot read messages';
  assert (select count(*) from public.availability_slots)=0, 'T36 unconnected student cannot see slots (FR-06.4)';
  assert (select count(*) from public.connections)=0, 'T37 unrelated student sees no connections';
end $$;

-- ===== admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
do $$
declare v_err text;
begin
  assert (select count(*) from public.admin_list_users(''))=6, 'T38 admin lists users';
  perform public.admin_review_mentor('00000000-0000-0000-0000-0000000000b2','approved');
  assert (select approval_status from public.mentor_profiles where id='00000000-0000-0000-0000-0000000000b2')='approved', 'T39 admin approves';
  begin perform public.admin_set_active('00000000-0000-0000-0000-0000000000d1', false); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%own account%', 'T40 admin cannot deactivate self';
  perform public.admin_set_active('00000000-0000-0000-0000-0000000000a1', false);
  assert (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000a1')=false, 'T41 admin deactivates';
end $$;

-- deactivated user (Alex) loses access to data
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$
declare v_err text;
begin
  assert (select count(*) from public.profiles)=1, 'T42a deactivated user sees only own profile row';
  assert (select count(*) from public.connections)=0, 'T42b deactivated user sees no connections';
  assert (select count(*) from public.messages)=0, 'T42c deactivated user sees no messages';
  begin perform public.send_connection_request('00000000-0000-0000-0000-0000000000b1','x'); v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err is not null, 'T42d deactivated user cannot send requests';
end $$;

-- ===== anon: no access at all
reset role; set role anon;
do $$
declare v_err text;
begin
  begin perform count(*) from public.profiles; v_err:=null; exception when others then v_err:=sqlerrm; end;
  assert v_err like '%permission denied%', 'T43 anon cannot read profiles';
end $$;
reset role;
\echo ALL RLS TESTS PASSED
