import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as paper from 'paper';
import { Raster, Matrix, Path } from 'paper';
import { view, Tool, Point, Layer } from 'paper/dist/paper-full';

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
  plotX = 0;
  plotY = 0;
  currentScale = 1;
  currentFactor = ScaleConfig.factor;
  // 座標軸関係
  xmin = 0;
  ymin = 0;
  xmax = 0;
  ymax = 0;
  // 各種フラグ
  isScaleEndRange = false;
  isEditAxis = false;
  isMouseOnStroke = false;
  isMouseDragging = false;
  // オンマウス状態のパスの子オブジェクト
  activeLocation: any;
  // レイヤー・グループ
  workingLayer: Layer;
  settingLayer: Layer;
  // その他
  defaultStrokeWidth = 3;

  constructor() { }

  ngOnInit(): void {
    paper.setup(this.canvas.nativeElement);
    this.setEventsToView();
    this.setLayers();
    this.setRangePath();
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
    this.updateRangePath();
  }

  setCurrentPosision(event): void {
    const rect = event.target.getBoundingClientRect();
    const preX = this.currentX = view.viewToProject(event.clientX - rect.left).x;
    const preY = this.currentY = view.viewToProject(event.clientY - rect.top).y;

    // viewの座標系をプロット座標系に変換する
    const leftPath = this.settingLayer.children[0];
    const rightPath = this.settingLayer.children[1];
    const topPath = this.settingLayer.children[2];
    const bottomPath = this.settingLayer.children[3];
    if (this.xmax - this.xmin !== 0) {
      const scaleX = Math.abs((this.xmax - this.xmin) / (leftPath.bounds.left - rightPath.bounds.right));
      const diffX = preX - leftPath.bounds.left;
      this.plotX = leftPath.bounds.left < rightPath.bounds.right ? this.xmin + diffX * scaleX : this.xmax + diffX * scaleX;
    }
    if (this.ymin - this.ymax !== 0) {
      const scaleY = Math.abs((this.ymin - this.ymax) / (bottomPath.bounds.bottom - topPath.bounds.top));
      const diffY = preY - bottomPath.bounds.bottom;
      this.plotY = bottomPath.bounds.bottom > topPath.bounds.top ? this.ymin - diffY * scaleY : this.ymax - diffY * scaleY;
    }
  }

  resetViewConfig(): void {
    view.matrix.reset();
    this.currentScale = view.zoom;
    this.currentFactor = ScaleConfig.factor;
    this.currentX = this.currentY = 0;
    this.isScaleEndRange = this.currentScale === ScaleConfig.minScale || this.currentScale === ScaleConfig.maxScale;
    this.updateRangePath();
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

  setAxisRange(): void {
    this.isEditAxis = !this.isEditAxis;
    this.settingLayer.locked = !this.isEditAxis;
    this.settingLayer.visible = this.isEditAxis;
    this.workingLayer.locked = this.isEditAxis;
  }

  private setImageToCanvas(): void {
    // キャンバス上のオブジェクトを全てクリア
    this.workingLayer.removeChildren();
    // viewをクリア
    this.resetViewConfig();
    // 座標軸設定パスをリセット
    this.setRangePath();

    const raster = new Raster('image');
    // Rasterオブジェクトの中心をキャンバスの中心に合わせる
    raster.position = view.center;
    // 作業レイヤーにRasterオブジェクトを追加する
    this.workingLayer.addChild(raster);
  }

  private setEventsToView(): void {
    const tool = new Tool();
    tool.onMouseDrag = (event) => {
      // 画像読み込み前、または座標
      if (!this.file || !!this.activeLocation) { return; }
      // delta = 最後にクリックされた位置の座標 - 現在地の座標
      const delta = event.downPoint.subtract(event.point);
      view.scrollBy(delta);
      this.updateRangePath();
    };
  }

  private setLayers(): void {
    this.workingLayer = new Layer();
    this.settingLayer = new Layer({
      visible: false,
    });
  }

  private setRangePath(): void {
    this.settingLayer.removeChildren();

    const bounds = view.bounds;
    // 全パス共通
    const commonSetting = {
      strokeWidth: this.defaultStrokeWidth,
      strokeColor: '#9aa1ff',
      strokeScaling: false,
      opacity: 0.7,
    };
    const leftPath = new Path.Line({
      from: new Point(bounds.width / 4, bounds.top),
      to: new Point(bounds.width / 4, bounds.bottom),
      ...commonSetting,
    });
    const rightPath = new Path.Line({
      from: new Point(bounds.width * 3 / 4, bounds.top),
      to: new Point(bounds.width * 3 / 4, bounds.bottom),
      ...commonSetting,
    });
    const topPath = new Path.Line({
      from: new Point(bounds.left, bounds.height / 4),
      to: new Point(bounds.right, bounds.height / 4),
      ...commonSetting,
    });
    const bottomPath = new Path.Line({
      from: new Point(bounds.left, bounds.height * 3 / 4),
      to: new Point(bounds.right, bounds.height * 3 / 4),
      ...commonSetting,
    });

    this.settingLayer.addChildren([
      leftPath,
      rightPath,
      topPath,
      bottomPath,
    ]);

    this.setMouseEventToRangePath(this.settingLayer.children);
  }

  private setMouseEventToRangePath(paths: any[]): void {
    paths.forEach(path => {
      path.onMouseMove = (event) => {
        // セグメントとストロークの当たり判定のみを有効にする
        const hitOptions = {
          stroke: true,
          tolerance: 1,
        };
        const hitResult = paper.project.hitTest(event.point, hitOptions);
        this.activeLocation = hitResult && hitResult.location;
        this.isMouseOnStroke = !!this.activeLocation;
      };

      path.onMouseDrag = (event) => {
        this.isMouseDragging = true;
        // 鉛直方向のpath
        if (path.bounds.width === 0) {
          path.bounds.left = path.bounds.right = this.currentX;
        }
        // 水平方向のpath
        if (path.bounds.height === 0) {
          path.bounds.top = path.bounds.bottom = this.currentY;
        }
      };

      path.onMouseUp = () => {
        this.isMouseDragging = false;
      };

      path.onMouseLeave = () => {
        if (this.activeLocation) {
          // セグメントをドラッグしている途中の場合は処理を行わない
          if (this.isMouseDragging) { return; }
          // セグメントからマウスが離れた場合はactiveItemとオンマウスのフラグをクリアする
          this.activeLocation = null;
          this.isMouseOnStroke = false;
        }
        this.isMouseOnStroke = false;
      };
    });
  }

  private updateRangePath(): void {
    this.settingLayer.children.forEach((path, i) => {
      // 鉛直方向のpath
      if (path.bounds.width === 0) {
        // 何故かtopが更新されないので、heightを更新してからbottomを合わせる
        path.bounds.height = view.bounds.height;
        path.bounds.bottom = view.bounds.bottom;
      }
      // 水平方向のpath
      if (path.bounds.height === 0) {
        // 何故かleftが更新されないので、widthを更新してからrightを合わせる
        path.bounds.width = view.bounds.width;
        path.bounds.right = view.bounds.right;
      }
    });
  }
}
