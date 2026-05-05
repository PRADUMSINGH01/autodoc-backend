const GOOGLE_API_KEY = "AIzaSyCxvIEWPWEcbxIVIh_tbQiYnp5_De1AKHw";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    }
}

listModels();
