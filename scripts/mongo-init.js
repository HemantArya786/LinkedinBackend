// scripts/mongo-init.js
// Runs once when the MongoDB Docker container is first initialised.

db = db.getSiblingDB('linkedin_clone');

db.createUser({
  user: 'appuser',
  pwd: 'apppassword',
  roles: [{ role: 'readWrite', db: 'linkedin_clone' }],
});

print('✅  MongoDB initialised: linkedin_clone database + appuser created');
