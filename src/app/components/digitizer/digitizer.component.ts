import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import * as paper from 'paper';
import { Raster, Path, Shape, Group } from 'paper';
import { view, Tool, Point, Layer } from 'paper/dist/paper-full';
import { Vertex } from '../../models/vertex';
import { MatMenuTrigger } from '@angular/material/menu';

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
  @ViewChild(MatMenuTrigger) contextMenu: MatMenuTrigger;

  file: File = null;
  imgSrc: string | ArrayBuffer = '';
  currentX = 0;
  currentY = 0;
  editStartPlotX: number;
  editStartPlotY: number;
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
  isItemDragging = false;
  isPlotting = false;
  isViewDragging = false;
  isMouseOnSegment = false;
  // オンマウス状態のパスの子オブジェクト
  activeLocation: any;
  activeSegment: any;
  // レイヤー・グループ
  backgroundLayer: Layer;
  plottingLayer: Layer;
  settingLayer: Layer;
  // プロット関係
  path: any;
  pathGroup: any;
  unsettledPath: any;
  vertexList: Vertex[] = [];
  // コンテキストメニュー関係
  contextMenuPosition = { x: '0px', y: '0px' };
  isEditMenuOpened = false;
  // CSV出力関係
  outFileName = 'coordinate.csv';

  constructor() { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // プロット可能状態の切り替え
    if (event.key === 'Escape') {
      if (this.file && !this.isEditAxis && this.path.segments.length > 0) {
        this.isPlotting = !this.isPlotting;
        // 未確定パスの表示・非表示を切り替える
        if (this.isPlotting) {
          this.drawUnsettledLine();
        } else {
          this.unsettledPath.removeSegments();
        }
      }
    }
    // プロットパスの削除処理
    if (event.key === 'Backspace') {
      if (this.path.selected && !this.isEditAxis) {
        if (confirm('パスを削除してよろしいですか？')) {
          // パスのセグメントを削除
          this.path.removeSegments();
          // プロットマーカーはindex=1以降に格納されているので全て削除
          this.pathGroup.children.splice(1);
          // 座標点リストをリセット
          this.vertexList = [];
          this.path.selected = false;
          this.isPlotting = true;
          this.activeLocation = null;
        }
      }
    }
  }

  ngOnInit(): void {
    paper.setup(this.canvas.nativeElement);
    this.setEventsToView();
    this.setLayers();
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
    this.currentX = view.viewToProject(event.clientX - rect.left).x;
    this.currentY = view.viewToProject(event.clientY - rect.top).y;
    const plotXY = this.convertViewToPlot(this.currentX, this.currentY);
    this.plotX = plotXY.x;
    this.plotY = plotXY.y;
    if (this.isPlotting) {
      this.drawUnsettledLine();
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
    this.plottingLayer.locked = this.isEditAxis;
  }

  onClickCanvas(): void {
    if (this.isViewDragging || !this.file || !this.isPlotting) {
      this.isViewDragging = false;
      return;
    }
    // 座標点リストにクリック位置のx, y座標を追加する
    this.vertexList.push({
      x: this.plotX,
      y: this.plotY,
    });
    this.plotMarker();
    this.drawLine();
  }

  openMenu(event: MouseEvent): boolean {
    if (this.isPlotting || (!this.isMouseOnSegment && !this.isMouseOnStroke)) { return true; }
    this.isEditMenuOpened = true;
    // デフォルトのコンテキストメニューを開かないようにする
    event.preventDefault();
    const editStartPlotXY = this.convertViewToPlot(this.currentX, this.currentY);
    this.editStartPlotX = editStartPlotXY.x;
    this.editStartPlotY = editStartPlotXY.y;
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.openMenu();
  }

  afterMenuClosed(): void {
    this.isEditMenuOpened = false;
    this.activeSegment = null;
    this.activeLocation = null;
    this.isMouseOnSegment = false;
    this.isMouseOnStroke = false;
  }

  addSegment(): void {
    const insertIndex = this.activeLocation.index + 1;
    this.path.insert(insertIndex, new Point(this.currentX, this.currentY));
    this.vertexList.splice(insertIndex, 0, { x: this.editStartPlotX, y: this.editStartPlotY });
    this.plotMarker(insertIndex);
    this.contextMenu.closeMenu();
  }

  removeSegment(): void {
    const removeIndex = this.activeSegment.index;
    this.path.removeSegment(removeIndex);
    this.vertexList.splice(removeIndex, 1);
    this.pathGroup.removeChildren(removeIndex + 1, removeIndex + 2);
    this.contextMenu.closeMenu();
    this.isMouseOnSegment = false;
  }

  exportCSV(): void {
    if (this.vertexList.length === 0) {
      alert('座標点がプロットされていません。');
      return;
    }

    const delimiter = ',';
    const header = ['No', 'X', 'Y'].join(delimiter) + '\n';
    const body = this.vertexList.map((vertex, index) => {
      return index + delimiter + Object.keys(vertex).map(key => {
        return vertex[key].toFixed(3);
      }).join(delimiter);
    }).join('\n');

    const csvString = header + body;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;'});
    const url = window.URL.createObjectURL(blob);

    const link: HTMLAnchorElement = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', this.outFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    // 座標点リストをリセット
    this.vertexList = [];

    const raster = new Raster('image');
    // Rasterオブジェクトの中心をキャンバスの中心に合わせる
    raster.position = view.center;
    // 作業レイヤーにRasterオブジェクトを追加する
    this.backgroundLayer.addChild(raster);
  }

  private setEventsToView(): void {
    const tool = new Tool();
    tool.onMouseDrag = (event) => {
      if (!this.file || !!this.activeLocation || this.isMouseOnSegment) { return; }
      this.isViewDragging = true;
      // delta = 最後にクリックされた位置の座標 - 現在地の座標
      const delta = event.downPoint.subtract(event.point);
      view.scrollBy(delta);
      this.updateRangePath();
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
        // ストロークの当たり判定のみを有効にする
        const hitOptions = {
          stroke: true,
          tolerance: 1,
        };
        const hitResult = paper.project.hitTest(event.point, hitOptions);
        this.activeLocation = hitResult && hitResult.location;
        this.isMouseOnStroke = !!this.activeLocation;
      };

      path.onMouseDrag = (event) => {
        this.isItemDragging = true;
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
        this.isItemDragging = false;
      };

      path.onMouseLeave = () => {
        if (this.activeLocation) {
          // パスをドラッグしている途中の場合は処理を行わない
          if (this.isItemDragging) { return; }
          // パスからマウスが離れた場合はactiveItemとオンマウスのフラグをクリアする
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
    this.setMouseEventToPlottedPath();
    this.pathGroup = new Group();
    this.pathGroup.addChild(this.path);
    this.plottingLayer.addChildren([
      this.pathGroup,
      this.unsettledPath,
    ]);

    // プロット準備完了
    this.isPlotting = true;
  }

  private convertViewToPlot(preX: number, preY: number): Point {
    // viewの座標系をプロット座標系に変換する
    const leftPath = this.settingLayer.children[0];
    const rightPath = this.settingLayer.children[1];
    const topPath = this.settingLayer.children[2];
    const bottomPath = this.settingLayer.children[3];
    let plotX = 0;
    let plotY = 0;
    if (this.xmax !== this.xmin) {
      const scaleX = Math.abs((this.xmax - this.xmin) / (leftPath.bounds.left - rightPath.bounds.right));
      const diffX = preX - leftPath.bounds.left;
      plotX = leftPath.bounds.left < rightPath.bounds.right ? this.xmin + diffX * scaleX : this.xmax + diffX * scaleX;
    }
    if (this.ymin !== this.ymax) {
      const scaleY = Math.abs((this.ymin - this.ymax) / (bottomPath.bounds.bottom - topPath.bounds.top));
      const diffY = preY - bottomPath.bounds.bottom;
      plotY = bottomPath.bounds.bottom > topPath.bounds.top ? this.ymin - diffY * scaleY : this.ymax - diffY * scaleY;
    }

    return new Point(plotX, plotY);
  }

  private plotMarker(insertIndex?: number): void {
    // 正方形のマーカー（パスの頂点を明示する印）を生成する
    const marker = new Shape.Circle({
      center: new Point(this.currentX, this.currentY),
      size: 8,
      strokeColor: '#ff0000',
    });
    if (insertIndex) {
      // 頂点追加処理の場合、パスグループの既存の子要素配列の間に挿入する
      this.pathGroup.insertChild(insertIndex + 1, marker);
    } else {
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
    if (this.path.segments.length === 0 || !this.path.lastSegment) { return; }
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

  private setMouseEventToPlottedPath(): void {
    this.path.onMouseMove = (event) => {
      if (this.isPlotting || this.isEditMenuOpened) { return; }
      // セグメントとストロークの当たり判定のみを有効にする
      const hitOptions = {
        fill: false,
        stroke: true,
        segments: true,
        tolerance: 1,
      };
      const hitResult = paper.project.hitTest(event.point, hitOptions);
      this.activeSegment = hitResult && hitResult.segment;
      this.isMouseOnSegment = !!this.activeSegment;
      this.activeLocation = hitResult && hitResult.location;
      this.isMouseOnStroke = !!this.activeLocation;
    };

    this.path.onMouseDrag = (event) => {
      if (this.isPlotting || !this.activeSegment) { return; }
      const index = this.activeSegment.index;
      this.isItemDragging = true;
      // パスのセグメントの座標を更新する
      this.activeSegment.point.x = event.point.x;
      this.activeSegment.point.y = event.point.y;
      // パス頂点のマーカーの座標を更新する
      this.pathGroup.children[index + 1].position.x = event.point.x;
      this.pathGroup.children[index + 1].position.y = event.point.y;
      // 座標点リストを更新する
      this.vertexList[index].x = this.plotX;
      this.vertexList[index].y = this.plotY;
    };

    this.path.onMouseUp = () => {
      if (this.isPlotting || !this.activeSegment) { return; }
      // プロット点用コンテキストメニューが開かれていない場合だけactiveItemとオンマウス、ドラッグのフラグをクリアする
      if (!this.isEditMenuOpened) {
        this.activeSegment = null;
        this.isMouseOnSegment = false;
      }
      this.isItemDragging = false;
    };

    this.path.onMouseLeave = () => {
      if (this.isPlotting || this.isItemDragging || this.isEditMenuOpened) { return; }
      // セグメントからマウスが離れた場合はactiveItemとオンマウスのフラグをクリアする
      this.activeSegment = null;
      this.activeLocation = null;
      this.isMouseOnSegment = false;
      this.isMouseOnStroke = false;
      this.isItemDragging = false;
    };

    this.path.onClick = () => {
      if (this.isPlotting) { return; }
      // パスの選択状態を切り替える
      this.path.selected = !this.path.selected;
    };
  }
}
