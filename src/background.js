// background.js - Handles requests from the UI, runs the model, then sends back a response

import { pipeline, env } from '@xenova/transformers';

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;


class TextPipelineSingleton {
    static task = 'text-classification';
    static model = 'AdamCodd/distilroberta-nsfw-prompt-stable-diffusion';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }

        return this.instance;
    }
}

class ImagePipelineSingleton {
    static task = 'image-classification';
    static model = 'AdamCodd/vit-base-nsfw-detector';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }

        return this.instance;
    }
}

// Create generic classify function, which will be reused for the different types of events.
const classify = async (text) => {
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let model = await TextPipelineSingleton.getInstance((data) => {
        // You can track the progress of the pipeline creation here.
        // e.g., you can send `data` back to the UI to indicate a progress bar
        // console.log('progress', data)
    });

    // Actually run the model on the input text
    let result = await model(text);
    return result;
};

// Create classifyImage function, which will be reused for the different image classification events.
const classifyImage = async (url) => {
    let classificationResults = null;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load image');

        const blob = await response.blob();
        // const image = new Image();
        // const imagePromise = new Promise((resolve, reject) => {
        //     image.onload = () => resolve(image);
        //     image.onerror = reject;
        //     image.src = URL.createObjectURL(blob);
        // });
        
        // const img = await imagePromise; // Ensure the image is loaded

        const imageBitmap = await createImageBitmap(blob);

        // Create an offscreen canvas
        const offscreenCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);

        // Convert the canvas to a Blob and then to a data URL
        const blobURL = await offscreenCanvas.convertToBlob().then(blob => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let model = await ImagePipelineSingleton.getInstance((data) => {
            // You can track the progress of the pipeline creation here.
            // e.g., you can send `data` back to the UI to indicate a progress bar
            // console.log('progress', data)
        });
        // classificationResults = await model([img.src]); // Classify the image
        classificationResults = await model([blobURL]); // Classify the image
        console.log('Predicted class: ', classificationResults[0].label);
        return classificationResults;
    } catch (error) {
        console.error('Error classifying image:', error);
        classificationResults = {"error": error.message};
    } finally {
        return classificationResults;
    }

};

////////////////////// 1. Context Menus //////////////////////
//
// Add a listener to create the initial context menu items,
// context menu items only need to be created at runtime.onInstalled
chrome.runtime.onInstalled.addListener(function () {
    // Register a context menu item that will only show up for selection text.
    chrome.contextMenus.create({
        id: 'classify-selection',
        title: 'Classify "%s"',
        contexts: ['selection'],
    });
});

// Perform inference when the user clicks a context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Ignore context menu clicks that are not for classifications (or when there is no input)
    if (info.menuItemId !== 'classify-selection' || !info.selectionText) return;

    // Perform classification on the selected text
    let result = await classify(info.selectionText);

    // Do something with the result
    chrome.scripting.executeScript({
        target: { tabId: tab.id },    // Run in the tab that the user clicked in
        args: [result],               // The arguments to pass to the function
        function: (result) => {       // The function to run
            // NOTE: This function is run in the context of the web page, meaning that `document` is available.
            console.log('result', result)
            console.log('document', document)
        },
    });
});
//////////////////////////////////////////////////////////////

////////////////////// 2. Message Events /////////////////////
// 
// Listen for messages from the UI, process it, and send the result back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('sender', sender)
    if (message.action === 'classify') {
        // Run model prediction asynchronously
        (async function () {
            // Perform text classification
            let result = await classify(message.text);

            // Send response back to UI
            sendResponse(result);
        })();
    } else if (message.action === 'classifyImage') {
        // Run model prediction asynchronously
        (async function () {
            // Perform image classification
            let result = await classifyImage(message.img_src);

            // Send response back to UI
            sendResponse(result);
        })();
    } else {
        // Ignore messages that are not meant for classification.
        return;
    }


    // return true to indicate we will send a response asynchronously
    // see https://stackoverflow.com/a/46628145 for more information
    return true;
});
//////////////////////////////////////////////////////////////

