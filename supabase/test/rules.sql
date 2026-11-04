-- Business-rule tests. Run against the local stub database after the migrations.
\set ON_ERROR_STOP 0
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', u::text, false) $$;
\set meera '11111111-0000-4000-8000-000000000001'
\set arjun '11111111-0000-4000-8000-000000000002'
\set kamala '11111111-0000-4000-8000-000000000011'
\set lakshmi '11111111-0000-4000-8000-000000000021'
\set ravi '11111111-0000-4000-8000-000000000031'
\set nandini '11111111-0000-4000-8000-000000000041'
set role authenticated;

\echo '--- family sees only own parents'
select pg_temp.as_user(:'meera'); select name from parents;
select pg_temp.as_user(:'arjun'); select name from parents;
\echo '--- BR2: families see only verified caregivers (expect 7)'
select count(*) from caregivers;
\echo '--- BR4: Lakshmi sees Kamala now (shift starts soon), not Ruma; readings of Kamala only'
select pg_temp.as_user(:'lakshmi'); select name from parents; select count(*) as readings from readings;
select parent_name, is_current, address is not null as has_address from caregiver_shifts() limit 3;
\echo '--- FR1: consent required'
select pg_temp.as_user(:'meera');
select add_parent('Venkat Iyer','Appa',81,'14, 3rd Main Road, Adyar','600020',array['Medicines'],'Mrs Rao',false);
select add_parent('Venkat Iyer','Appa',81,'14, 3rd Main Road, Adyar','600020',array['Medicines'],'Mrs Rao',true) is not null as added;
\echo '--- BR1 and BR2 on booking'
select book_care((select id from parents where name='Venkat Iyer'), '22222222-0000-4000-8000-000000000002', 12, current_date+1, 13);
select book_care((select id from parents where name='Venkat Iyer'), '22222222-0000-4000-8000-000000000004', 12, current_date+1, 14);
select book_care((select id from parents where name='Venkat Iyer'), '22222222-0000-4000-8000-000000000002', 12, current_date+1, 14) is not null as booked;
select count(*) as shifts_created from shifts where parent_id=(select id from parents where name='Venkat Iyer');
\echo '--- FR3: check in, task, reading, check out'
select pg_temp.as_user(:'lakshmi');
select check_in((select shift_id from caregiver_shifts() where is_current limit 1), 13.0067, 80.2571, 15, null);
select check_in((select shift_id from caregiver_shifts() where is_current limit 1), 13.0067, 80.2571, 15, 'p/s/door.jpg') is not null as checked_in;
select set_task((select visit_id from caregiver_shifts() where is_current limit 1), 'Morning medicines', true);
select add_reading((select visit_id from caregiver_shifts() where is_current limit 1), 132, 84, 138) is not null as reading;
select check_out((select visit_id from caregiver_shifts() where is_current limit 1));
select status from caregiver_shifts() where is_current limit 1;
\echo '--- BR3: no-show creates alert; FR6 replacement; BR5 escalation'
reset role;
update shifts set status='scheduled', start_at=now()-interval '40 minutes' where id=(select shift_id from visits v join shifts s on s.id=v.shift_id where s.caregiver_id='22222222-0000-4000-8000-000000000001' order by v.check_in_at desc limit 1);
delete from visits where check_in_at > now() - interval '5 minutes';
set role authenticated; select pg_temp.as_user(:'meera');
select check_no_shows() as marked;
select type, level, resolved_at is null as open from alerts where resolved_at is null;
select pg_temp.as_user(:'ravi');
select assign_replacement((select id from alerts where resolved_at is null and type='no_show' limit 1), '22222222-0000-4000-8000-000000000002', now() - interval '35 minutes') is not null as replaced;
select check_no_shows() as marked_again;
select type, level from alerts where resolved_at is null;
\echo '--- FR5: SOS from elder, resolved by coordinator'
select pg_temp.as_user(:'kamala'); select raise_sos() is not null as sos; select caregiver_name from elder_today();
select pg_temp.as_user(:'meera'); select count(*) as meera_sees_alerts from alerts where type='sos';
select pg_temp.as_user(:'ravi'); select resolve_alert((select id from alerts where type='sos' and resolved_at is null), 'Called, all fine');
\echo '--- FR9: KPIs admin only'
select pg_temp.as_user(:'meera'); select kpis();
select pg_temp.as_user(:'nandini'); select kpis();
\echo '--- FR7: verification hides until complete'
select pg_temp.as_user(:'ravi'); select set_check('22222222-0000-4000-8000-000000000004','police',true);
select pg_temp.as_user(:'meera'); select count(*) as visible_now from caregivers;
\echo '--- FR8: rate and renew'
select finish_block((select id from bookings where status='active' and parent_id=(select id from parents where name='Kamala Iyer')), 5, 'Great', true) is not null as renewed;
\echo '--- reset demo: family refused, admin allowed'
select reset_demo_data();
select pg_temp.as_user(:'nandini'); select reset_demo_data() like 'Demo data reset%' as reset_ok;
\echo '--- close account deletes parents'
select pg_temp.as_user(:'arjun'); select close_account(); select count(*) as arjun_parents from parents;
\echo '--- anon cannot read'
reset role; set role anon; select count(*) from parents;
