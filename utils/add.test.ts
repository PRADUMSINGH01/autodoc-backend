import add from './add.firebase';

// A simple manual test function
async function runTest() {
    try {
        console.log("Starting test for add()...");
        
        // Example test data
        const testData = {
            name: "Test Document",
            createdAt: new Date().toISOString(),
            status: "active"
        };

        // Call the add function
        const newDocId = await add({ 
            colletionName: "test_collection", 
            data: testData 
        });

        console.log(`✅ Success! Document created with ID: ${newDocId}`);
        
    } catch (error) {
        console.error("❌ Error adding document:", error);
    } finally {
        // Exit the process (necessary if Firebase keeps connection open)
        process.exit(0);
    }
}

// Execute the test
runTest();
