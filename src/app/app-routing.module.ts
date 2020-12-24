import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DigitizerComponent } from './components/digitizer/digitizer.component';

const routes: Routes = [
  { path: '', redirectTo: 'plotter', pathMatch: 'full' },
  { path: 'digitizer', component: DigitizerComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
