import { verifySessionToken } from './src/lib/auth-edge.js';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVlZDZmNWFlLWUzZDktNDIyZC04YWI0LWU4NjkzZTE5Mzk5OCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc5ODg4MjEwLCJleHAiOjE3Nzk5NzQ2MTB9.tyHOesgwpyk1LV8KBch9eTkBvy2ojOc6EAJ8ncZxwrA';

verifySessionToken(token)
  .then(session => {
    console.log('Session:', session);
  })
  .catch(err => {
    console.error('Error:', err);
  });