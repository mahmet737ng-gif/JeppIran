package com.tareghmsr.jeppiran

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class ChartBriefingPanel(
    private val activity: Activity,
    private val root: FrameLayout,
    private val brief: ChartBriefingEngine.Brief,
    private val onClose: () -> Unit
) {
    private val dark = (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private val density = activity.resources.displayMetrics.density
    private fun Int.dp()=(this*density).toInt()
    private fun bg(color:Int,r:Int=12)=GradientDrawable().apply { setColor(color);cornerRadius=r.dp().toFloat();setStroke(1.dp(),if(dark) Color.rgb(42,73,101) else Color.rgb(205,216,226)) }
    private fun text(s:String,size:Float=13f,bold:Boolean=false,color:Int=if(dark) Color.rgb(236,243,248) else Color.rgb(20,35,50))=TextView(activity).apply{
        this.text=s;textSize=size;setTextColor(color);if(bold) typeface=Typeface.DEFAULT_BOLD;setPadding(10.dp(),7.dp(),10.dp(),7.dp())
    }

    fun show() {
        val landscape=activity.resources.configuration.orientation==Configuration.ORIENTATION_LANDSCAPE
        val scrim=FrameLayout(activity).apply { setBackgroundColor(Color.argb(110,0,0,0));isClickable=true }
        val panel=LinearLayout(activity).apply {
            orientation=LinearLayout.VERTICAL
            background=bg(if(dark) Color.rgb(4,24,48) else Color.rgb(246,250,253),18)
            elevation=20.dp().toFloat()
        }
        val header=LinearLayout(activity).apply { orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(8.dp(),6.dp(),6.dp(),6.dp()) }
        val titles=LinearLayout(activity).apply { orientation=LinearLayout.VERTICAL }
        titles.addView(text(brief.title,19f,true))
        titles.addView(text(brief.subtitle,11f,false,if(dark) Color.rgb(159,188,211) else Color.rgb(77,103,125)))
        header.addView(titles,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        header.addView(text("×",28f).apply{gravity=Gravity.CENTER;contentDescription="Close briefing";setOnClickListener{root.removeView(scrim);onClose()}},
            LinearLayout.LayoutParams(48.dp(),48.dp()))
        panel.addView(header)

        val tabs=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(8.dp(),0,8.dp(),5.dp())}
        val names=if(brief.phase==ChartBriefingEngine.Phase.APPROACH) listOf("Overview","Descent","Approach","Missed","Airport") else listOf("Overview","Route","Climb","Restrictions","Airport")
        names.forEachIndexed{i,n->tabs.addView(text(n,11f,i==0,if(i==0) Color.rgb(38,155,255) else if(dark) Color.LTGRAY else Color.DKGRAY).apply{gravity=Gravity.CENTER;background=if(i==0) bg(if(dark) Color.rgb(8,51,88) else Color.rgb(230,244,255),7) else null},
            LinearLayout.LayoutParams(0,42.dp(),1f))}
        panel.addView(tabs)

        val body=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL;setPadding(8.dp(),4.dp(),8.dp(),12.dp())}
        brief.sections.forEach { sec ->
            val card=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL;background=bg(if(dark) Color.rgb(8,35,61) else Color.WHITE,10)}
            card.addView(text(sec.title,12f,true,if(dark) Color.rgb(151,205,247) else Color.rgb(15,86,143)))
            sec.rows.forEach { row ->
                val line=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.TOP}
                line.addView(text(row.label,11f,true,if(dark) Color.rgb(181,197,210) else Color.rgb(70,87,102)),LinearLayout.LayoutParams(if(landscape) 150.dp() else 105.dp(),LinearLayout.LayoutParams.WRAP_CONTENT))
                line.addView(text(row.value,12f,false,if(row.caution) Color.rgb(255,181,71) else if(dark) Color.WHITE else Color.rgb(20,35,50)),LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
                card.addView(line)
            }
            body.addView(card,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT).apply{setMargins(0,0,0,8.dp())})
        }
        val scroll=ScrollView(activity).apply{addView(body)}
        panel.addView(scroll,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,0,1f))
        scrim.addView(panel,FrameLayout.LayoutParams(if(landscape) 560.dp() else FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT).apply{
            gravity=if(landscape) Gravity.END else Gravity.CENTER
            if(!landscape){setMargins(8.dp(),8.dp(),8.dp(),8.dp())}
        })
        scrim.setOnClickListener{ if(it===scrim){root.removeView(scrim);onClose()} }
        root.addView(scrim,FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT))
    }
}
