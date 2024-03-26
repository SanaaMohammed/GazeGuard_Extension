var showAll = false,
    extensionUrl = chrome.extension.getURL(''),
    blankImg = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
    patternCSSUrl = 'url(' + extensionUrl + "img/pattern.png" + ')',
    patternLightUrl = extensionUrl + "img/pattern-light.png",
    patternLightCSSUrl = 'url(' + patternLightUrl + ')',
    eyeCSSUrl = 'url(' + extensionUrl + "img/eye.png" + ')',
    test = chrome.runtime.getURL("img/Animate.gif"),
    undoCSSUrl = 'url(' + extensionUrl + "img/undo.png" + ')',
    tagList = ['IMG', 'DIV', 'SPAN', 'A', 'UL', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'I', 'STRONG', 'B', 'BIG', 'BUTTON', 'CENTER', 'SECTION', 'TABLE', 'FIGURE', 'ASIDE', 'HEADER', 'VIDEO', 'P', 'ARTICLE'],
    tagListCSS = tagList.join(),
    elList = [],
    iframes = [],
    contentLoaded = false,
    settings = null;
    let Model_Type=5;
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.r == 'showImages') ShowImages();
        }
    );
chrome.runtime.sendMessage({ r: 'getSettings' }, function (s) {
        settings = s;
        if (settings) {
            chrome.runtime.sendMessage({ r: 'setColorIcon', toggle: true });
            console.log("Model_Type",settings.isYolov5);
            Model_Type=settings.isYolov5;
        }
                
    });

//keep track of contentLoaded
window.addEventListener('load', function () { 
    contentLoaded = true; 
    let imgs=document.querySelectorAll('img');
    for(let i=0;i<imgs.length;i++)
    {
        imgs[i].oldsrc=imgs[i].src;
        imgs[i].src=test;
        imgs[i].classList.add('initial');
       // console.log("img",imgs[i]);
    }
});
const labels = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
];
const useState = (defaultValue) => {
let value = defaultValue;
const getValue = () => value;
const setValue = (newValue) => (value = newValue);
return [getValue, setValue];
};
const numClass = labels.length;
const [session, setSession] = useState(null);
let mySession;
const modelInputShape = [1, 3, 640, 640];
const filesPaths = [
    chrome.runtime.getURL("model/yolov8n-seg.onnx"),
    chrome.runtime.getURL("model/nms-yolov8.onnx"),
    chrome.runtime.getURL("model/mask-yolov8-seg.onnx"),
    chrome.runtime.getURL("model/yolov5n-seg.onnx"),
    chrome.runtime.getURL("model/nms-yolov5.onnx"),
    chrome.runtime.getURL("model/mask-yolov5-seg.onnx"),
];
const dbName = "OnnxFiles";
const objectStoreName = "OnnxStore";
let db;
function createDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onupgradeneeded = (e) => {
            db = e.target.result;
            db.createObjectStore(objectStoreName, { keyPath: "Name" });
        };

        request.onsuccess = async (e) => {
            db = e.target.result;
            await storeFilesInDB();
            resolve();
        };

        request.onerror = (e) => {
            reject("Error");
        };
    });
}
const storeFilesInDB = async () => {
    let onnx;
    let onnxObj;
    let OnnxToDB = [];
    if (db) {
        const fetchPromises = filesPaths.map((filePath) => {
            return new Promise(async (resolve) => {
                onnx = db.transaction(objectStoreName, "readwrite");
                onnxObj = onnx.objectStore(objectStoreName);
                const keyToCheck = filePath;
                let existingRecord;

                const getRequest = onnxObj.get(keyToCheck);
                getRequest.onsuccess = (event) => {
                    existingRecord = event.target.result;
                    if (!existingRecord) {
                        OnnxToDB.push(filePath);
                    }
                    resolve();
                };
            });
        });
        await Promise.all(fetchPromises);
        const addPromises = OnnxToDB.map(async (filePath) => {
            const response = await fetch(filePath);
            const data = await response.arrayBuffer();
            const onnxFile = {
                Name: filePath,
                text: data,
            };
            onnx = db.transaction(objectStoreName, "readwrite");
            onnxObj = onnx.objectStore(objectStoreName);
            onnxObj.add(onnxFile);
        });

        await Promise.all(addPromises);
    }
};
async function retrieveOnnxFiles() {
    return new Promise((resolve) => {
        let arrayOnnxFiles = [];
        const onnx = db.transaction(objectStoreName, "readonly");
        const onnxObj = onnx.objectStore(objectStoreName);
        const request = onnxObj.openCursor();
        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                let name=cursor.value.Name;
                if(name.indexOf(Model_Type)!=-1)
                {
                    console.log(name);
                    arrayOnnxFiles.push(cursor.value.text);
                }
                cursor.continue();
            } else {
                resolve(arrayOnnxFiles);
            }
        };
    });
};
async function main() {
    await createDB();
    const onnxFilesArray = await retrieveOnnxFiles();
    return onnxFilesArray;
};
function loadOnnx() {
    return new Promise(async (resolve, reject) => {
        try {
            const buffers = await main();
            resolve(buffers);
        } catch (error) {
            reject(error);
        }
    });
};
cv["onRuntimeInitialized"] = async () => {
    //const startTime = performance.now();
    const buffers = await loadOnnx();
    console.log(buffers);
    const [yolov8, mask, nms] =  await Promise.all([
        await ort.InferenceSession.create(buffers[2]),
        await ort.InferenceSession.create(buffers[0]),
        await ort.InferenceSession.create(buffers[1]),
    ])
    
    const tensor = new ort.Tensor(
      "float32",
      new Float32Array(modelInputShape.reduce((a, b) => a * b)),
      modelInputShape
    );
    await yolov8.run({ images: tensor });
    mySession = setSession({ net: yolov8, nms: nms, mask: mask });
    DoWin(window, contentLoaded);
    };