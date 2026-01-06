const SUPABASE_CONFIG = {
    url: 'https://kjozzklnfsffpdibljpc.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb3p6a2xuZnNmZnBkaWJsanBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjA0MDMsImV4cCI6MjA4MzIzNjQwM30.a5SCZVjDZDpmzbUmQS86xIQWPqIWPTfk0aCT5HyCLkM'
};

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Export for use in app.js
window.supabaseClient = supabaseClient;
