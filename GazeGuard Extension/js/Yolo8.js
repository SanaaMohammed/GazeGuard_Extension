function segYolov8Type(imgIMG)
    {
    const topk = 100;
    const iouThreshold = 0.45;
    const scoreThreshold = 0.2;
    let canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    canvas.id='canvas';

    // Detect Image Function
    const detectImage = async (
            image,
            canvas,
            session,
            topk,
            iouThreshold,
            scoreThreshold,
            inputShape
        ) => {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // clean canvas
        
            const [modelWidth, modelHeight] = inputShape.slice(2);
            const maxSize = Math.max(modelWidth, modelHeight); // max size in input model
            const [input, xRatio, yRatio] = preprocessing(image, modelWidth, modelHeight); // preprocess frame
        
        const tensor = new ort.Tensor("float32", input.data32F, inputShape); // to ort.Tensor
        const config = new ort.Tensor(
            "float32",
            new Float32Array([
                80, // num class
                topk, // topk per class
                iouThreshold, // iou threshold
                scoreThreshold, // score threshold
            ])
            ); // nms config tensor
            const { output0, output1 } = await session.net.run({ images: tensor }); // run session and get output layer. out1: detect layer, out2: seg layer
            const { selected } = await session.nms.run({ detection: output0, config: config }); // perform nms and filter boxes
        
            const boxes = []; // ready to draw boxes
            const overlay = cv.Mat.zeros(modelHeight, modelWidth, cv.CV_8UC4); // create overlay to draw segmentation object
        
            // looping through output
            for (let idx = 0; idx < selected.dims[1]; idx++) {
            const data = selected.data.slice(idx * selected.dims[2], (idx + 1) * selected.dims[2]); // get rows
            let box = data.slice(0, 4); // det boxes
            const scores = data.slice(4, 4 + numClass); // det classes probability scores
            const score = Math.max(...scores); // maximum probability scores
            const label = scores.indexOf(score); // class id of maximum probability scores
            const color = colors.get(label); // get color

            if(labels[label]=="person"){

            
            box = overflowBoxes(
                [
                box[0] - 0.5 * box[2], // before upscale x
                box[1] - 0.5 * box[3], // before upscale y
                box[2], // before upscale w
                box[3], // before upscale h
                ],
                maxSize
            ); // keep boxes in maxSize range
        
            const [x, y, w, h] = overflowBoxes(
                [
                Math.floor(box[0] * xRatio), // upscale left
                Math.floor(box[1] * yRatio), // upscale top
                Math.floor(box[2] * xRatio), // upscale width
                Math.floor(box[3] * yRatio), // upscale height
                ],
                maxSize
            ); // upscale boxes
        
            boxes.push({
                label: labels[label],
                probability: score,
                color: color,
                bounding: [x, y, w, h], // upscale box
            }); // update boxes to draw later
        
            const mask = new ort.Tensor(
                "float32",
                new Float32Array([
                ...box, // original scale box
                ...data.slice(4 + numClass), // mask data
                ])
            ); // mask input
            const maskConfig = new ort.Tensor(
                "float32",
                new Float32Array([
                maxSize,
                x, // upscale x
                y, // upscale y
                w, // upscale width
                h, // upscale height
                ...Colors.hexToRgba(color, 120), // color in RGBA
                ])
            ); // mask config
            const { mask_filter } = await session.mask.run({
                detection: mask,
                mask: output1,
                config: maskConfig,
            }); // get mask

            const mask_mat = cv.matFromArray(
                mask_filter.dims[0],
                mask_filter.dims[1],
                cv.CV_8UC4,
                mask_filter.data
            ); // mask result to Mat

            cv.addWeighted(overlay, 1, mask_mat, 1, 0, overlay); // Update mask overlay
            mask_mat.delete(); // delete unused Mat
            
        }
    }
        const mask_img = new ImageData(
            new Uint8ClampedArray(overlay.data),
            overlay.cols,
            overlay.rows
        ); // create image data from mask overlay
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newData = new Uint8ClampedArray(imageData.data.map((value, index) => {
    if (mask_img.data[index % mask_img.data.length] >= 50) {
        switch (index % 4) {
        case 0:
            return 100;
        case 1:
            return 100;
        case 2:
            return 100;
        case 3:
            return 100;
        default:
            return value;
        }
    }
    return value;
    }));
    imageData.data.set(newData);
    ctx.putImageData(imageData, 0, 0);
    console.log("Original Image SRC:", image.src);
    console.log("Modified Image SRC:", canvas.toDataURL("image/png"));
    if(imgIMG.tagName!="IMG" && imgIMG.tagName!="VIDEO"){
    imgIMG.style.backgroundImage = 'url("' + (canvas.toDataURL("image/png")) + '")';

    }
    else{
    imgIMG.src=(canvas.toDataURL("image/png"));
    }
    input.delete(); // delete unused Mat
    overlay.delete(); // delete unused Mat
    };
    /**
     * Get divisible image size by stride
     * @param {Number} stride
     * @param {Number} width
     * @param {Number} height
     * @returns {Number[2]} image size [w, h]
     */
    const divStride = (stride, width, height) => {
    if (width % stride !== 0) {
        if (width % stride >= stride / 2)
        width = (Math.floor(width / stride) + 1) * stride;
        else width = Math.floor(width / stride) * stride;
    }
    if (height % stride !== 0) {
        if (height % stride >= stride / 2)
        height = (Math.floor(height / stride) + 1) * stride;
        else height = Math.floor(height / stride) * stride;
    }
    return [width, height];
    };

    /**
     * Preprocessing image
     * @param {HTMLImageElement} source image source
     * @param {Number} modelWidth model input width
     * @param {Number} modelHeight model input height
     * @param {Number} stride model stride
     * @return preprocessed image and configs
     */
    const preprocessing = (source, modelWidth, modelHeight, stride = 32) => {
    const mat = cv.imread(source); // read from img tag
    const matC3 = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3); // new image matrix
    cv.cvtColor(mat, matC3, cv.COLOR_RGBA2BGR); // RGBA to BGR

    const [w, h] = divStride(stride, matC3.cols, matC3.rows);
    cv.resize(matC3, matC3, new cv.Size(w, h));

    // padding image to [n x n] dim
    const maxSize = Math.max(matC3.rows, matC3.cols); // get max size from width and height
    const xPad = maxSize - matC3.cols, // set xPadding
        xRatio = maxSize / matC3.cols; // set xRatio
    const yPad = maxSize - matC3.rows, // set yPadding
        yRatio = maxSize / matC3.rows; // set yRatio
    const matPad = new cv.Mat(); // new mat for padded image
    cv.copyMakeBorder(
        matC3,
        matPad,
        0,
        yPad,
        0,
        xPad,
        cv.BORDER_CONSTANT,
        [0, 0, 0, 255]
    ); // padding black

    const input = cv.blobFromImage(
        matPad,
        1 / 255.0, // normalize
        new cv.Size(modelWidth, modelHeight), // resize to model input size
        new cv.Scalar(0, 0, 0),
        true, // swapRB
        false // crop
    ); // preprocessing image matrix

    // release mat opencv
    mat.delete();
    matC3.delete();
    matPad.delete();

    return [input, xRatio, yRatio];
    };

   
  /**
   * Handle overflow boxes based on maxSize
   * @param {Number[4]} box box in [x, y, w, h] format
   * @param {Number} maxSize
   * @returns non overflow boxes
   */
  const overflowBoxes = (box, maxSize) => {
    box[0] = box[0] >= 0 ? box[0] : 0;
    box[1] = box[1] >= 0 ? box[1] : 0;
    box[2] = box[0] + box[2] <= maxSize ? box[2] : maxSize - box[0];
    box[3] = box[1] + box[3] <= maxSize ? box[3] : maxSize - box[1];
    return box;
  };
  class Colors {
// ultralytics color palette https://ultralytics.com/
constructor() {
    this.palette = [
    "#FF3838",
    "#FF9D97",
    "#FF701F",
    "#FFB21D",
    "#CFD231",
    "#48F90A",
    "#92CC17",
    "#3DDB86",
    "#1A9334",
    "#00D4BB",
    "#2C99A8",
    "#00C2FF",
    "#344593",
    "#6473FF",
    "#0018EC",
    "#8438FF",
    "#520085",
    "#CB38FF",
    "#FF95C8",
    "#FF37C7",
    ];
    this.n = this.palette.length;
}

get = (i) => this.palette[Math.floor(i) % this.n];

static hexToRgba = (hex, alpha) => {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        alpha,
        ]
    : null;
};
  }
  const colors = new Colors();
    function runInference() {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        if(imgIMG.tagName!="IMG" && imgIMG.tagName!="VIDEO"){
            let srcBG = JSON.parse(imgIMG.oldsrc.replace(/^url\((.*)\)$/, '$1'));
            img.src=srcBG;
            
            }
            else{
                img.src = imgIMG.oldsrc;
            }
        img.onload = function () {
            detectImage(
            img,
            canvas,
            mySession,
            topk,
            iouThreshold,
            scoreThreshold,
            modelInputShape
            );
        };
    }
    runInference();
}