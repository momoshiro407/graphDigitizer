import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as paper from 'paper';
import { Raster } from 'paper';
import { view } from 'paper';

@Component({
  selector: 'app-digitizer',
  templateUrl: './digitizer.component.html',
  styleUrls: ['./digitizer.component.scss']
})
export class DigitizerComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvas: ElementRef<HTMLCanvasElement>
  @ViewChild('fileInput', { static: false }) fileInput: ElementRef;

  dataSource = [
    { n: 1, x: 12345, y: 12345 },
  ];

  file: File = null;
  imgSrc: string | ArrayBuffer = '';

  constructor() { }

  ngOnInit(): void {
    paper.setup(this.canvas.nativeElement);
  }

  onChangeFileInput(event): void {
    if (event.target.files.length === 0) {
      this.file = null;
      this.imgSrc = '';
      return;
    }

    const image = new Image();
    const fileReader = new FileReader();
    this.file = event.target.files[0];
    fileReader.onload = () => {
      this.imgSrc = fileReader.result;
      image.src = fileReader.result as string;
      image.onload = () => {
        // 読み込んだ画像の幅・高さを取得する
        this.setImageToCanvas(image.naturalWidth, image.naturalHeight);
      }
    }
    fileReader.readAsDataURL(this.file);
  }

  onClickFileInputButton(): void {
    if (!this.file || confirm('新しく画像を読み込みますか？\n前の画像やプロット状態などは保存されません。')) {
      this.fileInput.nativeElement.click();
    }
  }

  setImageToCanvas(imageWidth: number, imageHeight: number): void {
    // キャンバス上のオブジェクトを全てクリア
    paper.project.activeLayer.removeChildren();

    const raster = new Raster('image');
    // Rasterオブジェクトの幅と高さを、読み込んだ画像の幅・高さに合わせる
    raster.width = imageWidth;
    raster.height = imageHeight;
    // Rasterオブジェクトの中心をキャンバスの中心に合わせる
    raster.position = view.center;
  }
}
