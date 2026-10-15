#!/usr/bin/env python3
"""Disposable, Unix-socket-only PostgreSQL tests; never opens an existing database."""
from pathlib import Path
import os,subprocess,tempfile,shutil,json
root=Path(__file__).resolve().parents[1]
configured=os.environ.get('FRIDA_PG_ROOT')
if configured:
 pgroot=Path(configured);binary=pgroot/'usr/lib/postgresql/18/bin';share=pgroot/'usr/share/postgresql/18'
else:
 options=sorted(Path('/usr/lib/postgresql').glob('*/bin/initdb'),key=lambda p:int(p.parents[1].name),reverse=True)
 if not options:raise SystemExit('Provide PostgreSQL >=16 tools or FRIDA_PG_ROOT for isolated tests.')
 binary=options[0].parent;share=Path('/usr/share/postgresql')/binary.parent.name;pgroot=Path('/')
version=subprocess.check_output([str(binary/'postgres'),'--version'],text=True)
assert int(version.split()[2].split('.')[0])>=16
with tempfile.TemporaryDirectory(prefix='frida-pg-test-') as temporary:
 work=Path(temporary);data=work/'data';sock=work/'socket';sock.mkdir();assets=work/'assets';assets.mkdir();staging=work/'staging';staging.mkdir();restored=work/'restored';restored.mkdir()
 env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','LANG')}
 env['LD_LIBRARY_PATH']=str(pgroot/'usr/lib/x86_64-linux-gnu')
 env['PGHOST']=str(sock);env['PGDATABASE']='postgres';env['PGUSER']='fixture_owner'
 subprocess.run([str(binary/'initdb'),'-D',str(data),'-L',str(share),'--no-locale','--auth=trust','--username=fixture_owner'],env=env,check=True,stdout=subprocess.DEVNULL)
 started=False
 try:
  subprocess.run([str(binary/'pg_ctl'),'-D',str(data),'-l',str(work/'postgres.log'),'-o',f"-k {sock} -c listen_addresses='' -c shared_buffers=32MB -c max_connections=20 -c jit=off",'-w','start'],env=env,check=True,stdout=subprocess.DEVNULL);started=True
  for name in ('frida_source','frida_restore','frida_dirty'):
   subprocess.run([str(binary/'createdb'),name],env=env,check=True,stdout=subprocess.DEVNULL)
  password='disposable-fixture-password-123456'
  def service(name,user,database):
   path=work/(name+'.service');path.write_text(f'[frida]\nhost={sock}\nport=5432\ndbname={database}\nuser={user}\npassword={password}\nsslmode=disable\n');path.chmod(0o600);return str(path)
  owner=service('owner','fixture_owner','frida_source');backup=service('backup','frida_domain_backup','frida_source');restore=service('restore','fixture_owner','frida_restore');dirty=service('dirty','fixture_owner','frida_dirty')
  env.update(PGSERVICEFILE=owner,PGSERVICE='frida',PG_BIN_DIRECTORY=str(binary),FRIDA_EMPTY_INSTALL='true',FRIDA_APP_DB_PASSWORD=password,FRIDA_BACKUP_DB_PASSWORD=password,ASSET_DIRECTORY=str(assets),BACKUP_STAGING_DIRECTORY=str(staging),NODE_ENV='test')
  node=shutil.which('node',path=env['PATH']);assert node
  for command in ('provision','init'):
   subprocess.run([node,'deployment/tools.mjs',command],cwd=root,env=env,check=True)
  cert=work/'cert.pem';key=work/'key.pem'
  subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1','-days','1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  from urllib.parse import quote
  url=f'postgresql://frida_domain_app:{password}@localhost/frida_source?host='+quote(str(sock),safe='')
  env.update(DATABASE_URL=url,FRIDA_TEST_OWNER_SERVICE=owner,FRIDA_TEST_BACKUP_SERVICE=backup,FRIDA_TEST_RESTORE_SERVICE=restore,FRIDA_TEST_DIRTY_SERVICE=dirty,FRIDA_TEST_RESTORED_ASSETS=str(restored),FRIDA_TEST_KEY=str(key),FRIDA_TEST_CERT=str(cert),NODE_EXTRA_CA_CERTS=str(cert))
  result=subprocess.run([node,'node_modules/vitest/vitest.mjs','run','--config','vitest.integration.config.ts'],cwd=root,env=env)
  raise SystemExit(result.returncode)
 finally:
  if started:subprocess.run([str(binary/'pg_ctl'),'-D',str(data),'-m','immediate','-w','stop'],env=env,check=True,stdout=subprocess.DEVNULL)
