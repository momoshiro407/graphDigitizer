import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import * as paper from 'paper';
import { Raster, Path, Shape, Group } from 'paper';
import { view, Tool, Point, Layer } from 'paper/dist/paper-full';
import { Vertex } from '../../models/vertex';

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

  file: File = null;
  imgSrc: string | ArrayBuffer = '';
  currentX = 0;
  currentY = 0;
  plotX = 0;
  plotY = 0;
  scale = 1;
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
  isPlotting = false;
  isViewDragging = false;
  // オンマウス状態のパスの子オブジェクト
  activeLocation: any;
  // レイヤー・グループ
  backgroundLayer: Layer;
  plottingLayer: Layer;
  settingLayer: Layer;
  // プロット関係
  path: any;
  pathGroup: any;
  unsettledPath: any;
  vertexList: Vertex[] = [];

  constructor() { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key !== 'Escape') { return; }
    if (this.file && this.path.segments.length > 0) {
      this.isPlotting = false;
      this.unsettledPath.removeSegments();
    }
  }

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
    this.scale = view.zoom;
    this.updateRangePath();
  }

  setCurrentPosision(event): void {
    if (!this.file) { return; }
    const rect = event.target.getBoundingClientRect();
    const preX = this.currentX = view.viewToProject(event.clientX - rect.left).x;
    const preY = this.currentY = view.viewToProject(event.clientY - rect.top).y;
    if (this.isPlotting) {
      this.drawUnsettledLine();
    }

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
    this.scale = view.zoom;
    this.currentFactor = ScaleConfig.factor;
    this.currentX = this.currentY = 0;
    this.isScaleEndRange = false;
    this.updateRangePath();
  }

  zoomOut(cursorPoint?: Point): void {
    if (view.zoom === ScaleConfig.minScale) { return; }
    if (view.zoom !== ScaleConfig.maxScale) {
      this.currentFactor = ScaleConfig.factor;
    }
    const nextScale = view.zoom / this.currentFactor;
    // scaleの下限値より小さくなってしまう場合は、scaleが下限値になるfactorを逆算する
    if (nextScale < ScaleConfig.minScale) {
      this.currentFactor = view.zoom / ScaleConfig.minScale;
    }

    // 縮小処理を実行
    view.matrix.scale(1 / this.currentFactor, cursorPoint || view.center);
    this.isScaleEndRange = view.zoom === ScaleConfig.minScale;
  }

  zoomUp(cursorPoint?: Point): void {
    if (view.zoom === ScaleConfig.maxScale) { return; }
    if (view.zoom !== ScaleConfig.minScale) {
      this.currentFactor = ScaleConfig.factor;
    }
    const nextScale = view.zoom * this.currentFactor;
    // scaleの上限値より大きくなってしまう場合は、scaleが上限値になるfactorを逆算する
    if (nextScale > ScaleConfig.maxScale) {
      this.currentFactor = ScaleConfig.maxScale / view.zoom;
    }

    // 拡大処理を実行
    view.matrix.scale(this.currentFactor, cursorPoint || view.center);
    this.isScaleEndRange = view.zoom === ScaleConfig.maxScale;
  }

  setAxisRange(): void {
    this.isEditAxis = !this.isEditAxis;
    this.isPlotting = !this.isEditAxis;
    this.settingLayer.locked = !this.isEditAxis;
    this.settingLayer.visible = this.isEditAxis;
    this.backgroundLayer.locked = this.isEditAxis;
    this.plottingLayer.locked = this.isEditAxis;
  }

  onClickCanvas(): void {
    if (this.isViewDragging || !this.file || !this.isPlotting) { return; }
    // パスの頂点座標の配列にクリック位置のx, y座標を追加する
    this.vertexList.push({
      x: this.plotX,
      y: this.plotY,
    });
    this.plotMarker();
    this.drawLine();
  }

  private setImageToCanvas(): void {
    // 背景画像をクリア
    this.backgroundLayer.removeChildren();
    // viewの表示設定をクリア
    this.resetViewConfig();
    // 座標軸設定パスをリセット
    this.setRangePath();
    // プロット用パスをリセット
    this.initialPathItemsSetting();

    const raster = new Raster('image');
    // Rasterオブジェクトの中心をキャンバスの中心に合わせる
    raster.position = view.center;
    // 作業レイヤーにRasterオブジェクトを追加する
    this.backgroundLayer.addChild(raster);
    this.isPlotting = true;
  }

  private setEventsToView(): void {
    const tool = new Tool();
    tool.onMouseDrag = (event) => {
      // 画像読み込み前、または座標
      if (!this.file || !!this.activeLocation) { return; }
      this.isViewDragging = true;
      // delta = 最後にクリックされた位置の座標 - 現在地の座標
      const delta = event.downPoint.subtract(event.point);
      view.scrollBy(delta);
      this.updateRangePath();
    };
    tool.onMouseUp = (event) => {
      if (this.isViewDragging) {
        this.isViewDragging = false;
      }
    };
  }

  private setLayers(): void {
    this.backgroundLayer = new Layer();
    this.plottingLayer = new Layer();
    this.settingLayer = new Layer({
      visible: false,
    });
  }

  private setRangePath(): void {
    this.settingLayer.removeChildren();

    const bounds = view.bounds;
    // 全パス共通
    const commonSetting = {
      strokeWidth: 2,
      strokeColor: '#9aa1ff',
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

  private initialPathItemsSetting(): void {
    this.plottingLayer.removeChildren();
    this.unsettledPath = new Path();
    this.path = new Path();
    this.pathGroup = new Group();
    this.pathGroup.addChildren([
      this.unsettledPath,
      this.path,
    ]);
    this.plottingLayer.addChild(this.pathGroup);
  }

  private plotMarker(insertIndex?: number): void {
    // 正方形のマーカー（パスの頂点を明示する印）を生成する
    const marker = new Shape.Circle({
      center: new Point(this.currentX, this.currentY),
      size: 5,
      strokeColor: '#ff0000',
    });
    if (insertIndex) {
      // 頂点追加処理の場合、パスグループの既存の子要素配列の間に挿入する
      this.pathGroup.insertChild(insertIndex + 1, marker);
    } else {
      // 多角形を閉じる前はパスグループの子要素配列の末尾に追加していく
      this.pathGroup.addChild(marker);
    }
  }

  private drawLine(): void {
    this.path.strokeColor = '#ff0000';
    this.path.strokeWidth = 1;
    this.path.add(new Point(this.currentX, this.currentY));
    this.unsettledPath.removeSegments();
  }

  private drawUnsettledLine(): void {
    if (this.path.segments.length === 0 || !this.path.lastSegment || !this.isPlotting) { return; }
    this.unsettledPath.removeSegments();
    // 未確定パスの設定
    this.unsettledPath.strokeColor = 'rgb(0, 0, 0, 0.1)';
    this.unsettledPath.strokeWidth = 1;
    // 確定パスの最先端にある頂点座標を取得する
    const lastSegment = this.path.lastSegment.point;
    // 未確定パスの始点
    this.unsettledPath.add(new Point(lastSegment.x, lastSegment.y));
    // 未確定パスの終点
    this.unsettledPath.add(new Point(this.currentX, this.currentY));
  }
}
