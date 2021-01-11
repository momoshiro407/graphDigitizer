import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as paper from 'paper';
import { Raster, Matrix } from 'paper';
import { view, Tool, Point } from 'paper/dist/paper-full';

enum ScaleConfig {
  factor = 1.05,
  minScale = 0.5,
  maxScale = 3,
}

@Component({
  selector: 'app-digitizer',
  templateUrl: './digitizer.component.html',
  styleUrls: ['./digitizer.component.scss']
})
export class DigitizerComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvas: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput: ElementRef;

  dataSource = [
    { n: 1, x: 12345, y: 12345 },
  ];

  file: File = null;
  imgSrc: string | ArrayBuffer = '';
  currentX = 0;
  currentY = 0;
  originViewCenter: Point;
  currentScale = 1;
  currentFactor = ScaleConfig.factor;
  isScaleEndRange = false;

  constructor() { }

  ngOnInit(): void {
    paper.setup(this.canvas.nativeElement);
    this.setEventsToView();
    this.originViewCenter = view.center;
  }

  onChangeFileInput(event): void {
    if (event.target.files.length === 0) {
      this.file = null;
      this.imgSrc = '';
      return;
    }

    const image = new Image();
    image.onload = () => {
      this.setImageToCanvas();
    };
    const fileReader = new FileReader();
    this.file = event.target.files[0];
    fileReader.readAsDataURL(this.file);
    fileReader.onload = () => {
      this.imgSrc = fileReader.result;
      image.src = fileReader.result as string;
    };
  }

  onClickFileInputButton(): void {
    if (!this.file || confirm('新しく画像を読み込みますか？\n前の画像やプロット状態などは保存されません。')) {
      this.fileInput.nativeElement.click();
    }
  }

  scalingView(event): void {
    event.preventDefault();
    if (!this.file) { return; }
    const cursorPoint = new Point(this.currentX, this.currentY);

    if (event.wheelDeltaY > 0) {
      this.zoomUp(cursorPoint); // 拡大
    } else {
      this.zoomOut(cursorPoint); // 縮小
    }
  }

  setCurrentPosision(event): void {
    const rect = event.target.getBoundingClientRect();
    this.currentX = view.viewToProject(event.clientX - rect.left).x;
    this.currentY = view.viewToProject(event.clientY - rect.top).y;
  }

  resetViewConfig(): void {
    view.matrix.reset();
    this.currentScale = view.zoom;
    this.currentFactor = ScaleConfig.factor;
    this.currentX = this.currentY = 0;
    this.isScaleEndRange = this.currentScale === ScaleConfig.minScale || this.currentScale === ScaleConfig.maxScale;
  }

  zoomOut(cursorPoint?: Point): void {
    if (this.currentScale === ScaleConfig.minScale) { return; }
    if (this.currentScale !== ScaleConfig.maxScale) {
      this.currentFactor = ScaleConfig.factor;
    }
    // 現在のscalに現在のfactorを除算した結果
    const nextScale = this.currentScale / this.currentFactor;
    // scaleの下限値より小さくなってしまう場合は、scaleが下限値になるfactorを逆算する
    if (nextScale < ScaleConfig.minScale) {
      this.currentFactor = this.currentScale / ScaleConfig.minScale;
    }

    // 縮小処理を実行
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    view.transform(matrix.scale(1 / this.currentFactor, cursorPoint || view.center));
    this.currentScale = Math.max(ScaleConfig.minScale , nextScale);
    this.isScaleEndRange = this.currentScale === ScaleConfig.minScale || this.currentScale === ScaleConfig.maxScale;
  }

  zoomUp(cursorPoint?: Point): void {
    if (this.currentScale === ScaleConfig.maxScale) { return; }
    if (this.currentScale !== ScaleConfig.minScale) {
      this.currentFactor = ScaleConfig.factor;
    }
    const nextScale = this.currentScale * this.currentFactor;
    // scaleの上限値より大きくなってしまう場合は、scaleが上限値になるfactorを逆算する
    if (nextScale > ScaleConfig.maxScale) {
      this.currentFactor = ScaleConfig.maxScale / this.currentScale;
    }

    // 拡大処理を実行
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    view.transform(matrix.scale(this.currentFactor, cursorPoint || view.center));
    this.currentScale = Math.min(ScaleConfig.maxScale, nextScale);
    this.isScaleEndRange = this.currentScale === ScaleConfig.minScale || this.currentScale === ScaleConfig.maxScale;
  }

  private setImageToCanvas(): void {
    // キャンバス上のオブジェクトを全てクリア
    paper.project.activeLayer.removeChildren();

    const raster = new Raster('image');
    // Rasterオブジェクトの中心をキャンバスの中心に合わせる
    raster.position = view.center;
  }

  private setEventsToView(): void {
    const tool = new Tool();
    tool.activate();
    tool.onMouseDrag = (event) => {
      if (!this.file) { return; }
      // delta = 最後にクリックされた位置の座標 - 現在地の座標
      const delta = event.downPoint.subtract(event.point);
      view.scrollBy(delta);
    };
  }
}
