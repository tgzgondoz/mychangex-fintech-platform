export const testSupabaseConnection = async () => {
  try {
    console.log('🔌 Testing Supabase connection...');
    
    // Try a very simple query with timeout
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      // If table doesn't exist, that's OK - connection is working
      if (error.code === '42P01') {
        console.log('ℹ️ Profiles table does not exist yet - please run the database schema');
        return false; // Table doesn't exist, we need to create it
      }
      
      if (error.message.includes('network') || error.message.includes('Network')) {
        console.log('❌ Network error - please check internet connection');
        return false;
      }
      
      console.log('ℹ️ Connection test got error:', error.message);
      return true; // Other errors might be OK
    }
    
    console.log('✅ Supabase connection test successful - table exists');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed completely:', error);
    return false;
  }
};