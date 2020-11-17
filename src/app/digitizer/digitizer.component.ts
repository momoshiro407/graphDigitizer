import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-digitizer',
  templateUrl: './digitizer.component.html',
  styleUrls: ['./digitizer.component.scss']
})
export class DigitizerComponent implements OnInit {
  dataSource = [
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
    { n: 1, x: 12345, y: 12345 },
  ];

  constructor() { }

  ngOnInit(): void {
  }

}
