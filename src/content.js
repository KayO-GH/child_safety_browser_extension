// prevent the page from being loaded until the classification is complete
document.documentElement.style.visibility = 'hidden';

let NSFW_detected = false;

document.addEventListener("DOMContentLoaded", function () {
    // Classify text
    chrome.runtime.sendMessage({
        action: 'classify',
        text: document.body.textContent,
    }, (response) => {
        console.log(response);
        if (response[0]['label'] !== 'SFW' && response[0]['score'] > 0.8) {
            NSFW_detected = true;
            window.alert("NSFW content detected. Please close this tab.");
        } else {
            document.documentElement.style.visibility = "visible"; // make visible, but start image checks... not optimal

        }
    });

    let imgs = Array.from(document.getElementsByTagName('img'));

    for (let img of imgs) {
        let img_src = img.src;
        // Classify image
        chrome.runtime.sendMessage({
            action: 'classifyImage',
            img_src: img_src,
        }, (response) => {
            // console.log(response[0]['label']);
            console.log(response);
            console.log("IMG SRC original: ", img_src);
            if (response[0]['label'] !== 'sfw') {
                console.log("IMG SRC: ", img_src);
                document.documentElement.style.visibility = "hidden";
            }
        });
    }


});

