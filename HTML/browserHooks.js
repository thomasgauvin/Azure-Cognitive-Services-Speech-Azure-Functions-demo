/*
* Notice: Any links, references, or attachments that contain sample scripts, code, or commands comes with the following notification.
*
* This Sample Code is provided for the purpose of illustration only and is not intended to be used in a production environment.
* THIS SAMPLE CODE AND ANY RELATED INFORMATION ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED,
* INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A PARTICULAR PURPOSE.
*
* We grant You a nonexclusive, royalty-free right to use and modify the Sample Code and to reproduce and distribute the object code form of the Sample Code,
* provided that You agree:
*
* (i) to not use Our name, logo, or trademarks to market Your software product in which the Sample Code is embedded;
* (ii) to include a valid copyright notice on Your software product in which the Sample Code is embedded; and
* (iii) to indemnify, hold harmless, and defend Us and Our suppliers from and against any claims or lawsuits,
* including attorneys’ fees, that arise or result from the use or distribution of the Sample Code.
*
* Please note: None of the conditions outlined in the disclaimer above will superseded the terms and conditions contained within the Premier Customer Services Description.
*
* DEMO POC - "AS IS"
*/

//Note:
//This method parses the document for text nodes that should be read. 
//It then calls the speach-to-text of each of the nodes. 
//
//The code parses the document for text nodes using the helper method extractTextNodes, and stores a reference to these in trimmedTextNodes.
//Upon click of the Start synthesis button, the code calls synthesizer.speakSsmlAsync() on the first trimmed text nodes.
//The progress through the trimmedTextNodes is tracked using textNodeIndex
//Once the player finishes, it increments the textNodeIndex and calls synthesizeMain() again. (this is specified in player.onAudioEnd)

//The highlighting replaces the innerHTML of the block quote elements with the word being highlighted.

// status fields and start button in UI
var resultsDiv,
    eventsDiv,
    talkingHeadDiv,
    highlightDiv;
var startSynthesisAsyncButton, pauseButton, resumeButton;
var updateVoiceListButton;

// subscription key and region for speech services.
var subscriptionKey, regionOptions;
var authorizationToken;
var voiceOptions, isSsml;
var SpeechSDK;
var synthesisText;
var synthesizer;
var player;
var wordBoundaryList = [];

document.addEventListener("DOMContentLoaded", function () {
    startSynthesisAsyncButton = document.getElementById("startSynthesisAsyncButton");
    updateVoiceListButton = document.getElementById("updateVoiceListButton");
    pauseButton = document.getElementById("pauseButton");
    resumeButton = document.getElementById("resumeButton");
    var skipAheadButton = document.getElementById("skipAheadButton");
    var skipBackButton = document.getElementById("skipBackButton");
    subscriptionKey = document.getElementById("subscriptionKey");
    regionOptions = document.getElementById("regionOptions");
    resultsDiv = document.getElementById("resultsDiv");
    eventsDiv = document.getElementById("eventsDiv");
    voiceOptions = document.getElementById("voiceOptions");
    isSsml = document.getElementById("isSSML");
    talkingHeadDiv = document.getElementById("talkingHeadDiv");
    highlightDiv = document.getElementById("highlightDiv");
    speed = document.getElementById("speed");

    //the following lines are used to keep state of the clone DOM tree
    textNodeIndex = 0;
    trimmedTextNodes = extractTextNodes(document.getElementById('main')); 

    //set highlight text & highlighted portion
    highlightInterval = setHighlightingInterval();

    //reset player on speed change
    speed.addEventListener("change", resetPlayer)

    //reset player on voice change
    voiceOptions.addEventListener("change", resetPlayer)

    //get list of voices
    updateVoiceListButton.addEventListener("click", function () {
        var request = new XMLHttpRequest();
        request.open('GET',
                'https://' + regionOptions.value + ".tts.speech." +
                (regionOptions.value.startsWith("china") ? "azure.cn" : "microsoft.com") +
                        "/cognitiveservices/voices/list", true);
        if (authorizationToken) {
        request.setRequestHeader("Authorization", "Bearer " + authorizationToken);
        } else {
        if (subscriptionKey.value === "" || subscriptionKey.value === "subscription") {
            alert("Please enter your Microsoft Cognitive Services Speech subscription key!");
            return;
        }
        request.setRequestHeader("Ocp-Apim-Subscription-Key", subscriptionKey.value);
        }

        request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            const response = this.response;
            const defaultVoice = "ChristopherNeural";
            let selectId;
            const data = JSON.parse(response);
            voiceOptions.innerHTML = "";
            data.forEach((voice, index) => {
            voiceOptions.innerHTML += "<option value=\"" + voice.Name + "\">" + voice.Name + "</option>";
            if (voice.Name.indexOf(defaultVoice) > 0) {
                selectId = index;
            }
            });
            voiceOptions.selectedIndex = selectId;
            voiceOptions.disabled = false;
        } else {
            window.console.log(this);
            eventsDiv.innerHTML += "cannot get voice list, code: " + this.status + " detail: " + this.statusText + "\r\n";
        }
        };

        request.send()
    });

    //set pause button
    pauseButton.addEventListener("click", function () {
        player.pause();
        pauseButton.disabled = true;
        resumeButton.disabled = false;
    });

    //set pause button
    resumeButton.addEventListener("click", function () {
        player.resume();
        pauseButton.disabled = false;
        resumeButton.disabled = true;
    });

    //set skip ahead button
    skipAheadButton.addEventListener("click", function () {
        player.pause();
        textNodeIndex += 1;
        continueReading();
    });

    //set skip back button
    skipBackButton.addEventListener("click", function () {
        player.pause();
        textNodeIndex -= 1;
        continueReading();
    });

    //function to reset player
    function resetPlayer() {
        player.pause();
        clearInterval(highlightInterval);
        setTimeout(() => {
            removeExistingHighlight();
            resetTTSButtons();
            highlightInterval = setHighlightingInterval();
        }, 101);
    }
    
    //helper method to continue reading
    function continueReading(){
        if(textNodeIndex < trimmedTextNodes.length){
            synthesizeMain();
            pauseButton.disabled = false;
            resumeButton.disabled = true;
        }
        else{
            removeExistingHighlight();
            textNodeIndex = 0;
        }
    }

    function synthesizeMain() {
        ssmlPrependLength = getSsmlPrependLength();
        resultsDiv.innerHTML = "";
        eventsDiv.innerHTML = "";
        wordBoundaryList = [];
        synthesisText = document.getElementById("synthesisText");

        // use authorization token to access speech service
        var speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, regionOptions.value);        

        speechConfig.speechSynthesisVoiceName = voiceOptions.value;
        speechConfig.speechSynthesisOutputFormat = formatOptions.value;

        player = new SpeechSDK.SpeakerAudioDestination();
        player.onAudioStart = function(_) {
            window.console.log("playback started");
            setTimeout(function(){ $("svg path :first-child").each( function(i) {this.beginElement();}); }, 0.5);
        }
        player.onAudioEnd = function (_) {
            window.console.log("playback finished");
            eventsDiv.innerHTML += "playback finished" + "\r\n";
            startSynthesisAsyncButton.disabled = false;
            pauseButton.disabled = true;
            resumeButton.disabled = true;
            wordBoundaryList = [];

            textNodeIndex += 1;
            continueReading();
        };

        function createSynth(){
            var audioConfig  = SpeechSDK.AudioConfig.fromSpeakerOutput(player);
            synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

            // The event synthesizing signals that a synthesized audio chunk is received.
            // You will receive one or more synthesizing events as a speech phrase is synthesized.
            // You can use this callback to streaming receive the synthesized audio.
            synthesizer.synthesizing = function (s, e) {
                eventsDiv.innerHTML += "(synthesizing) Reason: " + SpeechSDK.ResultReason[e.result.reason] +
                        "Audio chunk length: " + e.result.audioData.byteLength + "\r\n";
            };

            // The synthesis started event signals that the synthesis is started.
            synthesizer.synthesisStarted = function (s, e) {
                eventsDiv.innerHTML += "(synthesis started)" + "\r\n";
                pauseButton.disabled = false;
            };

            // The event synthesis completed signals that the synthesis is completed.
            synthesizer.synthesisCompleted = function (s, e) {
                eventsDiv.innerHTML += "(synthesized)  Reason: " + SpeechSDK.ResultReason[e.result.reason] +
                        " Audio length: " + e.result.audioData.byteLength + "\r\n";
            };

            // The event signals that the service has stopped processing speech.
            // This can happen when an error is encountered.
            synthesizer.SynthesisCanceled = function (s, e) {
                const cancellationDetails = SpeechSDK.CancellationDetails.fromResult(e.result);
                let str = "(cancel) Reason: " + SpeechSDK.CancellationReason[cancellationDetails.reason];
                if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                str += ": " + e.result.errorDetails;
                }
                eventsDiv.innerHTML += str + "\r\n";
                startSynthesisAsyncButton.disabled = false;
                pauseButton.disabled = true;
                resumeButton.disabled = true;
            };

            // This event signals that word boundary is received. This indicates the audio boundary of each word.
            // The unit of e.audioOffset is tick (1 tick = 100 nanoseconds), divide by 10,000 to convert to milliseconds.
            synthesizer.wordBoundary = function (s, e) {
                eventsDiv.innerHTML += "(WordBoundary), Text: " + e.text + ", Audio offset: " + e.audioOffset / 10000 + "ms." + "\r\n";
                wordBoundaryList.push(e);
            };

            synthesizer.bookmarkReached = function (s, e) {
                eventsDiv.innerHTML +=  "(Bookmark reached), Audio offset: " + e.audioOffset / 10000 + "ms. Bookmark text: " + e.text + '\n';
            }

            if (!synthesisText.value) {
                alert("Please enter synthesis content.");
                return;
            }

            startSynthesisAsyncButton.disabled = true;
        }

        function playSynth(){
            const complete_cb = function (result) {
                console.log(`complete cb`)
                console.log(textNodeIndex)
                console.log(trimmedTextNodes[textNodeIndex])
                if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                resultsDiv.innerHTML += "synthesis finished";
                } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                resultsDiv.innerHTML += "synthesis failed. Error detail: " + result.errorDetails;
                }
        
                window.console.log(result);
                synthesizer.close();
                synthesizer = undefined;
                console.log('closed synthesizer')
            };
            const err_cb = function (err) {
                startSynthesisAsyncButton.disabled = false;
                phraseDiv.innerHTML += err;
                window.console.log(err);
                synthesizer.close();
                synthesizer = undefined;
            };

            if (isSsml.checked) {
                //create ssml with voice tag
                var ssml = getSsmlPrepend() + 
                            (trimmedTextNodes[textNodeIndex].innerHTML !== undefined ? trimmedTextNodes[textNodeIndex].innerHTML : trimmedTextNodes[textNodeIndex].textContent) + 
                            getSsmlAppend();
                synthesizer.speakSsmlAsync(ssml,
                        complete_cb,
                        err_cb);
            } else {
                alert("Please select SSML checkbox.");
                // synthesizer.speakTextAsync(trimmedTextNodes[textNodeIndex].textContent,
                //         complete_cb,
                //         err_cb);
            }
        }
        
        createSynth();
        playSynth();
    }

    //start synthesis of speech from text
    startSynthesisAsyncButton.addEventListener("click", synthesizeMain);

    Initialize(async function (speechSdk) {
        SpeechSDK = speechSdk;
        startSynthesisAsyncButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;

        formatOptions.innerHTML = "";
        Object.keys(SpeechSDK.SpeechSynthesisOutputFormat).forEach(format => {
        if (isNaN(format) && !format.includes('Siren')) {
            formatOptions.innerHTML += "<option value=\"" + SpeechSDK.SpeechSynthesisOutputFormat[format] + "\">" + format + "</option>"
        }}
        );
        formatOptions.selectedIndex = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

        // in case we have a function for getting an authorization token, call it.
        if (typeof RequestAuthorizationToken === "function") {
            await RequestAuthorizationToken();
        }
    });
});


//helper method to extract text nodes from a node
function extractTextNodes(node) {
    //extract all elements with block level tag
    var blockLevelTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre', 'blockquote'];
    var textNodes = [];
    if (node.nodeType === 3) {
        textNodes.push(node);
    } else {
        if (blockLevelTags.includes(node.nodeName.toLowerCase())) {
            textNodes.push(node);
        } else {
            for (var i = 0; i < node.childNodes.length; i++) {
                textNodes = textNodes.concat(extractTextNodes(node.childNodes[i]));
            }
        }
    }

    //trim text nodes to remove 
    const trimmedTextNodes = textNodes.filter(node => {
        //if text content exists and contains text other than punctuation
        return node.textContent.trim().length > 0 && node.textContent.trim().match(/[a-zA-Z0-9]/);
    });

    return trimmedTextNodes;
}

//helper method to get ssmlprepend content
function getSsmlPrepend(){
    return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" + "<voice name='" + voiceOptions.value + "'> <prosody rate='"+ ((document.getElementById("speed").value * 100)-100) +"%'>";
}

//helper method to get ssmlappend content
function getSsmlAppend(){
    return "</prosody></voice></speak>";
}

//helper method to get ssmlprepend length
function getSsmlPrependLength() {
    return getSsmlPrepend().length;
}

//helper method to remove existing highlight span
function removeExistingHighlight(){
    if(document.getElementById("highlight-span") !== null){
        var parent = document.getElementById("highlight-span").parentElement;
        document.getElementById("highlight-span").replaceWith(document.getElementById("highlight-span").innerHTML);
        parent.normalize();
    }
}

//helper method to set highlighting, refreshing every 100ms
function setHighlightingInterval(){
    return setInterval(function () {
        if (player !== undefined && !player.privIsPaused) {
            const currentTime = player.currentTime;
            var wordBoundary;
            for (const e of wordBoundaryList) {
                if (currentTime * 1000 > e.audioOffset / 10000) {
                wordBoundary = e;
                } else {
                break;
                }
            }
            if (wordBoundary !== undefined) {

                //remove existing highlight (required to remove highlighting from previous word when moving on to next node)
                removeExistingHighlight();

                nodeInOriginalTree = trimmedTextNodes[textNodeIndex];
                //replace current tree node with clone tree node, highlighting the current word
                nodeInOriginalTree.innerHTML = nodeInOriginalTree.innerHTML.substr(0, wordBoundary.textOffset - ssmlPrependLength) +
                        "<span id='highlight-span' class='highlight'>" + wordBoundary.text + "</span>" +
                        nodeInOriginalTree.innerHTML.substr(wordBoundary.textOffset + wordBoundary.wordLength - ssmlPrependLength);

            } else {
                highlightDiv.innerHTML = synthesisText.value;
            }
        }
    }, 100);
}

//helper method to enable start synthesis button, enable pause button, disable resume button
function resetTTSButtons(){
    startSynthesisAsyncButton.disabled = false;
    pauseButton.disabled = true;
    resumeButton.disabled = true;
}

