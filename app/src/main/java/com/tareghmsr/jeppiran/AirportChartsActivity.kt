package com.tareghmsr.jeppiran

import android.animation.ValueAnimator
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class AirportChartsActivity :
    AppCompatActivity() {

    private lateinit var root:
        LinearLayout

    private lateinit var chartScrollView:
        ScrollView

    private lateinit var listContainer:
        LinearLayout

    private lateinit var categoryTitle:
        TextView

    private lateinit var searchBox:
        EditText

    private lateinit var searchContainer:
        LinearLayout

    private var searchBarHidden =
        false

    private var searchBarAnimation:
        ValueAnimator? =
        null

    private var ignoreSearchBarScroll =
        false

    private var lastChartScrollY =
        0

    private var downwardScrollDistance =
        0

    private var upwardScrollDistance =
        0

    private lateinit var categoryContainer:
        LinearLayout

    private lateinit var portraitCategoryScroll:
        HorizontalScrollView

    private lateinit var landscapeCategoryScroll:
        ScrollView

    private var icao =
        ""

    private var airportName =
        ""

    private var city =
        ""

    private var selectedCategory =
        ""

    private lateinit var repository:
        ChartRepository

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        icao =
            intent
                .getStringExtra(
                    "ICAO"
                )
                .orEmpty()
                .trim()
                .uppercase()

        airportName =
            intent
                .getStringExtra(
                    "AIRPORT_NAME"
                )
                .orEmpty()
                .trim()

        city =
            intent
                .getStringExtra(
                    "CITY"
                )
                .orEmpty()
                .trim()

        selectedCategory =
            intent
                .getStringExtra(
                    "CATEGORY"
                )
                .orEmpty()
                .trim()

        repository =
            ChartRepository(
                this
            )

        // Main Home opens directly to the unified airport workspace.
        if (icao.isBlank()) {
            val known = repository.getAirports()
            icao = known.find { it.icao == "OIII" }?.icao ?: known.firstOrNull()?.icao.orEmpty()
        }

        if (
            airportName.isBlank()
        ) {

            airportName =
                ChartRepository.airportName(icao)
        }

        if (
            city.isBlank()
        ) {

            city =
                ChartRepository.city(icao)
        }

        buildUi()

        loadCharts()
    }

    override fun onDestroy() {

        searchBarAnimation
            ?.cancel()

        super.onDestroy()
    }

    /**
     * Task 4. Photo-free airport profile in the approved JeppIran visual language.
     * Source-attributed fields only; no guessed ADC headings or operational weather.
     */
    private fun buildAirportFactsPanel(): View {
        val info = try {
            org.json.JSONObject(assets.open("airport-profiles.json").bufferedReader().use { it.readText() })
                .optJSONObject("airports")?.optJSONObject(icao)
        } catch (_: Exception) { null }
        val runways = try {
            org.json.JSONObject(assets.open("airport-runways.json").bufferedReader().use { it.readText() })
                .optJSONObject("airports")?.optJSONArray(icao)
        } catch (_: Exception) { null }
        val dark = isDarkTheme()
        val textColor = if (dark) Color.rgb(239,248,255) else Color.rgb(21,47,72)
        val muted = if (dark) Color.rgb(164,192,217) else Color.rgb(72,112,144)
        val cyan = if (dark) Color.rgb(59,198,255) else Color.rgb(0,112,205)
        val surface = if (dark) Color.rgb(7,28,51) else Color.WHITE
        val surface2 = if (dark) Color.rgb(9,41,71) else Color.rgb(233,246,255)
        val border = if (dark) Color.rgb(30,88,135) else Color.rgb(139,194,229)
        fun round(color: Int, highlight: Boolean = false): GradientDrawable =
            GradientDrawable().apply {
                cornerRadius = 13.dp.toFloat()
                setColor(color)
                setStroke(1.dp, if (highlight) cyan else border)
            }
        fun title(value: String, size: Float, color: Int = textColor, bold: Boolean = false): TextView =
            TextView(this).apply {
                text = value
                textSize = size
                setTextColor(color)
                if (bold) typeface = Typeface.DEFAULT_BOLD
            }
        fun stack(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        fun bar(): LinearLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        fun card(heading: String): LinearLayout = stack().apply {
            setPadding(14.dp, 13.dp, 14.dp, 13.dp)
            background = round(surface)
            addView(title(heading, 14f, cyan, true))
        }
        fun entry(k: String, v: String): LinearLayout = bar().apply {
            setPadding(0, 10.dp, 0, 6.dp)
            addView(title(k, 12f, muted), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(title(v, 12f, textColor, true))
        }
        fun value(name: String): String {
            if (info == null || !info.has(name) || info.isNull(name)) return "—"
            return info.optString(name, "—").ifBlank { "—" }
        }
        fun rwyValue(item: org.json.JSONObject, key: String): String =
            if (item.has(key) && !item.isNull(key)) item.optInt(key).toString() else "—"

        val outer = ScrollView(this).apply {
            isFillViewport = true
            isVerticalScrollBarEnabled = false
            setBackgroundColor(if (dark) Color.rgb(3,13,28) else Color.rgb(236,246,255))
        }
        val contents = stack().apply { setPadding(14.dp, 16.dp, 14.dp, 20.dp) }
        outer.addView(contents)
        val head = bar()
        val names = stack()
        val codes = bar()
        codes.addView(title(icao, 40f, textColor, true))
        if (value("iata") != "—") {
            codes.addView(title(value("iata"), 13f, cyan, true).apply {
                setPadding(12.dp, 6.dp, 12.dp, 6.dp)
                background = round(surface2)
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart=10.dp })
        }
        names.addView(codes)
        names.addView(title(value("name").takeUnless { it == "—" } ?: airportName, 19f, textColor, true))
        names.addView(title(
            listOf(value("city").takeUnless { it == "—" } ?: city, value("country"))
                .filter { it.isNotBlank() && it != "—" }.joinToString(", "),
            13f, cyan
        ))
        head.addView(names, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        val elevation = value("elevation")
        head.addView(stack().apply {
            addView(title(if (elevation=="—") "Elev —" else "Elev " + elevation + " ft", 12f, muted))
            addView(android.widget.TextClock(this@AirportChartsActivity).apply {
                timeZone = "UTC"
                format24Hour = "HH:mm'Z'"
                format12Hour = "HH:mm'Z'"
                textSize = 12f
                setTextColor(cyan)
            })
        })
        contents.addView(head)

        val tabs = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false }
        val tabBar = bar()
        fun tab(label: String, active: Boolean, action: () -> Unit) {
            tabBar.addView(title(label, 12f, if (active) Color.WHITE else muted, active).apply {
                setPadding(14.dp, 12.dp, 14.dp, 12.dp)
                gravity = Gravity.CENTER
                background = round(if (active) Color.rgb(11,119,231) else surface2, active)
                setOnClickListener { action() }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd=5.dp })
        }
        var weatherTarget: View? = null
        var notamTarget: View? = null
        var infoTarget: View? = null
        tab("Overview", true) { outer.smoothScrollTo(0,0) }
        tab("Charts", false) { showChartsBrowser(null) }
        tab("Weather", false) { weatherTarget?.let { outer.smoothScrollTo(0,it.top) } }
        tab("NOTAM", false) { notamTarget?.let { outer.smoothScrollTo(0,it.top) } }
        tab("Info", false) { infoTarget?.let { outer.smoothScrollTo(0,it.top) } }
        tabs.addView(tabBar)
        contents.addView(tabs, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 16.dp; bottomMargin = 12.dp })

        val landscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val left = stack()
        val right = stack()
        if (landscape) {
            contents.addView(bar().apply {
                gravity = Gravity.TOP
                addView(left, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.3f).apply { marginEnd = 9.dp })
                addView(right, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            })
        } else {
            contents.addView(left)
            contents.addView(right)
        }
        fun put(parent: LinearLayout, child: View) {
            parent.addView(child, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 12.dp })
        }
        val weather = card("METAR • " + icao)
        weatherTarget = weather
        weather.addView(title("☀☁   LIVE WEATHER", 21f, cyan, true).apply { setPadding(0,14.dp,0,8.dp) })
        weather.addView(title("Open Weather to obtain current METAR and TAF. No sample weather is shown as live.", 12f, muted))
        weather.addView(title("View METAR / TAF   ›", 14f, cyan, true).apply {
            setPadding(0,13.dp,0,3.dp)
            setOnClickListener {
                startActivity(Intent(this@AirportChartsActivity, WxActivity::class.java).putExtra("ICAO", icao))
            }
        })
        put(left,weather)

        val runwayCard = card("RUNWAYS")
        if (runways == null || runways.length() == 0) {
            runwayCard.addView(title("No runway record available • consult current ADC / AIP", 12f, muted))
        } else {
            for (index in 0 until runways.length()) {
                val item=runways.optJSONObject(index) ?: continue
                val name=item.optString("name", "—")
                val opposite=item.optString("opposite", "")
                val dims=rwyValue(item,"length")+" × "+rwyValue(item,"width")+" m"
                val heading=if (!item.isNull("headingTrue") && item.has("headingTrue"))
                    String.format(java.util.Locale.US, "%.1f° TRUE", item.optDouble("headingTrue"))
                    else "TRUE heading unavailable"
                val nameText=if (opposite.isBlank()) name else name+" / "+opposite
                val highlighted = name == (selectedTrueRunway.ifBlank { if (icao == "OIAA") "32L" else runways.optJSONObject(0)?.optString("name", "").orEmpty() })
                val row=bar().apply {
                    setPadding(11.dp,12.dp,11.dp,12.dp)
                    background=round(if (highlighted) (if (dark) Color.rgb(7,54,97) else Color.rgb(205,235,255)) else surface2, highlighted)
                    addView(title("▱  "+nameText, 13f, textColor, true), LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
                    addView(stack().apply {
                        addView(title(dims,12f,textColor,true))
                        addView(title(heading+" · MAG —",10f,muted))
                    })
                    setOnClickListener { selectTrueWindRunway(name) }
                }
                runwayCard.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin=6.dp })
            }
        }
        runwayCard.addView(title("Source: OurAirports community data. Verify with current ADC/AIP.",10f,muted))
        put(left,runwayCard)

        val shortcuts=bar()
        for ((name, category) in listOf(Pair("▤ CHARTS","Airport"), Pair("✈ APPROACHES","Approach"), Pair("▦ DIAGRAM","Airport"))) {
            shortcuts.addView(title(name,11f,cyan,true).apply {
                gravity=Gravity.CENTER
                setPadding(4.dp,17.dp,4.dp,17.dp)
                background=round(surface2)
                setOnClickListener { showChartsBrowser(category) }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd=5.dp })
        }
        put(left,shortcuts)

        val chosenName = selectedTrueRunway.ifBlank { if (icao == "OIAA") "32L" else runways?.optJSONObject(0)?.optString("name", "").orEmpty() }
        val runwayForWind = (0 until (runways?.length() ?: 0)).mapNotNull {
            runways?.optJSONObject(it)
        }.firstOrNull { it.optString("name") == chosenName }
            ?: runways?.optJSONObject(0)
        val windRunwayName = runwayForWind?.optString("name", "—") ?: "—"
        val trueBearing = if (runwayForWind != null && runwayForWind.has("headingTrue") && !runwayForWind.isNull("headingTrue"))
            runwayForWind.optDouble("headingTrue", Double.NaN) else Double.NaN
        val wind=card("WIND COMPONENTS  •  RWY " + windRunwayName)
        wind.addView(TrueRunwayCompassView(this).apply {
            runwayId = windRunwayName
            headingTrue = if (trueBearing.isFinite()) trueBearing.toFloat() else null
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 185.dp))
        wind.addView(entry("Runway bearing (TRUE / geographic)",
            if (trueBearing.isFinite()) String.format(java.util.Locale.US, "%.1f°", trueBearing) else "—"))
        wind.addView(entry("Magnetic bearing", "— · not verified"))
        wind.addView(entry("METAR wind (TRUE)", "—"))
        wind.addView(entry("↑ Headwind", "—"))
        wind.addView(entry("→ Crosswind", "—"))
        wind.addView(title("Bearing measured clockwise from TRUE north; magnetic variation is not added.",10f,muted))
        put(right,wind)

        val details=card("ADDITIONAL INFORMATION")
        infoTarget=details
        details.addView(entry("ICAO",icao))
        details.addView(entry("IATA",value("iata")))
        details.addView(entry("Elevation",if(elevation=="—") "—" else elevation+" ft"))
        details.addView(entry("Latitude",value("lat")))
        details.addView(entry("Longitude",value("lon")))
        details.addView(entry("ATIS / Tower / Ground","Consult ADC"))
        put(right,details)

        val notam=card("NOTAM")
        notamTarget=notam
        notam.addView(title("No verified current NOTAM feed attached. Consult an authorized source.",12f,muted))
        put(right,notam)
        return outer
    }


    /**
     * Task 5: a real left-side airport rail. It stays mounted while changing
     * airports and switching between the profile and chart browser.
     * The advanced PDF viewer remains separate until Task 6.
     */
    private var airportShell: LinearLayout? = null
    private lateinit var airportRail: LinearLayout
    private lateinit var airportRailRows: LinearLayout
    private lateinit var airportRailScroll: ScrollView
    private lateinit var airportRailSearch: EditText
    private var airportRailQuery = ""
    private val railExpanded = mutableSetOf("Airport")

    private fun railBackground(selected: Boolean = false): GradientDrawable {
        val dark = isDarkTheme()
        return GradientDrawable().apply {
            cornerRadius = 10.dp.toFloat()
            setColor(if (selected) (if (dark) Color.rgb(7, 50, 91) else Color.rgb(208, 235, 255))
                else (if (dark) Color.rgb(7, 31, 55) else Color.WHITE))
            setStroke(1.dp, if (selected) Color.rgb(41, 185, 245)
                else (if (dark) Color.rgb(25, 79, 125) else Color.rgb(153, 199, 229)))
        }
    }

    private fun railText(value: String, sp: Float, muted: Boolean = false): TextView =
        TextView(this).apply {
            text = value
            textSize = sp
            setTextColor(if (muted) (if (isDarkTheme()) Color.rgb(157,191,215) else Color.rgb(73,109,139))
                else if (isDarkTheme()) Color.rgb(244,250,255) else Color.rgb(21,47,69))
            if (!muted) typeface = Typeface.DEFAULT_BOLD
        }

    private fun railWidth(compact: Boolean): Int =
        if (resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            if (compact) 194.dp else 248.dp
        } else {
            if (compact) 114.dp else 148.dp
        }

    private fun adjustRail(compact: Boolean) {
        if (!::airportRail.isInitialized) return
        val lp = airportRail.layoutParams as? LinearLayout.LayoutParams ?: return
        val width = railWidth(compact)
        if (lp.width != width) {
            lp.width = width
            airportRail.layoutParams = lp
        }
    }

    private fun buildAirportRail(): View {
        airportRail = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = pageBackground()
            setPadding(5.dp, 28.dp, 5.dp, 7.dp)
        }
        airportRail.addView(railText("‹ Home", 13f, true).apply {
            setPadding(8.dp, 4.dp, 4.dp, 11.dp)
            setOnClickListener { finish() }
        })
        airportRail.addView(railText("Charts", 24f).apply {
            setPadding(8.dp, 0, 0, 9.dp)
        })
        airportRailSearch = EditText(this).apply {
            hint = "Search ICAO"
            textSize = 12f
            isSingleLine = true
            setTextColor(primaryTextColor())
            setHintTextColor(secondaryTextColor())
            setPadding(8.dp, 5.dp, 7.dp, 5.dp)
            background = railBackground()
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun afterTextChanged(s: Editable?) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    airportRailQuery = s?.toString()?.trim()?.uppercase(java.util.Locale.US).orEmpty()
                    renderRailAirports()
                }
            })
        }
        airportRail.addView(airportRailSearch, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 44.dp
        ).apply { bottomMargin = 10.dp })
        airportRailScroll = ScrollView(this).apply {
            isFillViewport = true
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            isVerticalScrollBarEnabled = false
        }
        airportRailRows = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        airportRailScroll.addView(airportRailRows)
        airportRail.addView(airportRailScroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        return airportRail
    }

    private fun selectAirportInRail(code: String) {
        if (code == icao) {
            showProfileView()
            adjustRail(false)
            return
        }
        icao = code
        selectedTrueRunway = if (code == "OIAA") "32L" else ""
        airportName = ChartRepository.airportName(code)
        city = ChartRepository.city(code)
        selectedCategory = ""
        searchBarAnimation?.cancel()
        searchBarHidden = false
        buildUi()
        loadCharts()
        renderRailAirports()
    }

    private fun renderRailAirports() {
        if (!::airportRailRows.isInitialized || !::airportRailScroll.isInitialized) return
        val oldScroll = airportRailScroll.scrollY
        airportRailRows.removeAllViews()
        val airports = repository.getAirports().filter {
            airportRailQuery.isBlank() ||
                it.icao.contains(airportRailQuery, ignoreCase = true) ||
                it.airportName.contains(airportRailQuery, ignoreCase = true) ||
                it.city.contains(airportRailQuery, ignoreCase = true)
        }
        for (airport in airports) {
            val chosen = airport.icao == icao
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(9.dp, 10.dp, 5.dp, 10.dp)
                background = railBackground(chosen)
                isClickable = true
                isFocusable = true
                setOnClickListener { selectAirportInRail(airport.icao) }
            }
            row.addView(railText(airport.icao, 17f))
            row.addView(railText(airport.airportName, 10f, true).apply { maxLines = 2 })
            if (chosen) row.addView(railText(airport.city, 10f, true))
            airportRailRows.addView(row, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 7.dp })

            if (chosen) {
                val groups = repository.getDisplayChartsForAirport(icao)
                    .groupBy { ChartRepository.normalizeCategory(it.category) }
                for (category in listOf("STAR", "SID", "Airport", "Approach")) {
                    val items = groups[category].orEmpty()
                    if (items.isEmpty()) continue
                    val expanded = railExpanded.contains(category)
                    val name = ChartRepository.displayCategory(category)
                    val header = railText((if (expanded) "▾ " else "▸ ") + name + " (" + items.size + ")", 12f).apply {
                        setPadding(6.dp, 10.dp, 3.dp, 10.dp)
                        background = railBackground()
                        setTextColor(if (isDarkTheme()) Color.rgb(70,203,255) else Color.rgb(0,112,193))
                        setOnClickListener {
                            if (expanded) railExpanded.remove(category) else railExpanded.add(category)
                            renderRailAirports()
                        }
                    }
                    airportRailRows.addView(header, LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { leftMargin=4.dp; bottomMargin=3.dp })
                    if (expanded) for (chart in items) {
                        airportRailRows.addView(railText(
                            (if (chart.chartNumber.isBlank()) "" else chart.chartNumber + " · ") + chart.name,
                            10f, true
                        ).apply {
                            setPadding(10.dp, 9.dp, 4.dp, 9.dp)
                            setOnClickListener { openChart(chart) }
                        }, LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply { leftMargin=7.dp })
                    }
                }
            }
        }
        airportRailScroll.post { airportRailScroll.scrollTo(0, oldScroll) }
    }

    private fun mountAirportWorkspace() {
        val prior = airportShell
        if (prior == null) {
            val newShell = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                background = pageBackground()
            }
            newShell.addView(buildAirportRail(), LinearLayout.LayoutParams(
                railWidth(false), LinearLayout.LayoutParams.MATCH_PARENT
            ))
            newShell.addView(root, LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f
            ))
            airportShell = newShell
            setContentView(newShell)
            BackNavigation.install(this)
            renderRailAirports()
        } else {
            prior.removeViewAt(1)
            prior.addView(root, 1, LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f
            ))
        }
    }

    // Only the selected runway changes. Keep the airport rail, charts and FSX untouched.
    private var selectedTrueRunway: String = ""

    private fun selectTrueWindRunway(name: String) {
        if (!::profilePanel.isInitialized || !::root.isInitialized) return
        selectedTrueRunway = name
        val index = root.indexOfChild(profilePanel)
        if (index < 0) return
        val prior = profilePanel
        val scrollY = (prior as? ScrollView)?.scrollY ?: 0
        val replacement = buildAirportFactsPanel()
        replacement.visibility = prior.visibility
        root.removeViewAt(index)
        profilePanel = replacement
        root.addView(replacement, index, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        (replacement as? ScrollView)?.let { view ->
            view.post { view.scrollTo(0, scrollY) }
        }
    }

    private lateinit var profilePanel: View
    private var inlineChartView: InlineAirportChartView? = null

    private fun showChartInline(chart: ChartRepository.ChartInfo) {
        inlineChartView?.let { root.removeView(it) }
        val panel = InlineAirportChartView(this, repository,
            exit = { showProfileView() },
            advanced = { item -> openChartAdvanced(item) }
        )
        inlineChartView = panel
        root.addView(panel, root.indexOfChild(profilePanel) + 1,
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        for (i in 0 until root.childCount) {
            val child = root.getChildAt(i)
            child.visibility = if (child === panel) View.VISIBLE else View.GONE
        }
        adjustRail(true)
        panel.open(chart)
    }



    private fun showProfileView() {
        if (!::profilePanel.isInitialized || !::root.isInitialized) return
        adjustRail(false)
        for (i in 0 until root.childCount) {
            val child = root.getChildAt(i)
            child.visibility = if (child === profilePanel) View.VISIBLE else View.GONE
        }
    }

    private fun showChartsBrowser(category: String?) {
        if (!::profilePanel.isInitialized || !::root.isInitialized) return
        adjustRail(true)
        for (i in 0 until root.childCount) {
            val child = root.getChildAt(i)
            child.visibility = if (child === profilePanel || child === inlineChartView)
                View.GONE else View.VISIBLE
        }
        if (!category.isNullOrEmpty() && ::searchBox.isInitialized) selectCategory(category)
    }

    private fun buildUi() {

        root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                background =
                    pageBackground()
            }

        val header =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    10.dp
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    if (
                        icao.isNotBlank()
                    ) {
                        icao
                    } else {
                        "AIRPORT CHARTS"
                    }

                textSize =
                    24f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    1
            }

        val airportText =
            TextView(
                this
            ).apply {

                text =
                    buildAirportSubtitle()

                textSize =
                    15f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    2

                setPadding(
                    0,
                    4.dp,
                    0,
                    0
                )
            }

        val cityText =
            TextView(
                this
            ).apply {

                text =
                    city

                textSize =
                    13f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    3.dp,
                    0,
                    0
                )

                visibility =
                    if (
                        city.isBlank()
                    ) {
                        View.GONE
                    } else {
                        View.VISIBLE
                    }
            }

        header.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            airportText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            cityText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            TextView(
                this
            ).apply {
                text = "✈  OPERATIONAL BRIEF"
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                setPadding(14.dp, 0, 14.dp, 0)
                background = GradientDrawable().apply {
                    cornerRadius = 14.dp.toFloat()
                    setColor(getColor(R.color.jeppiran_blue))
                }
                setOnClickListener {
                    startActivity(
                        Intent(
                            this@AirportChartsActivity,
                            PilotBriefingActivity::class.java
                        ).putExtra("ICAO", icao)
                    )
                }
            },
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                42.dp
            ).apply {
                setMargins(0, 12.dp, 0, 0)
            }
        )

        root.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        header.addView(TextView(this).apply {
            text = "‹ AIRPORT PROFILE"
            textSize = 13f
            setTextColor(if (isDarkTheme()) Color.rgb(65,194,255) else Color.rgb(0,115,204))
            setPadding(0,12.dp,0,2.dp)
            setOnClickListener { showProfileView() }
        })


        profilePanel = buildAirportFactsPanel()
        root.addView(profilePanel, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        searchContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    createSearchBackground()

                setPadding(
                    12.dp,
                    0,
                    12.dp,
                    0
                )
            }

        searchContainer.addView(
            TextView(
                this
            ).apply {

                text =
                    "⌕"

                textSize =
                    22f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                contentDescription =
                    "Search procedures"
            },
            LinearLayout.LayoutParams(
                34.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        searchBox =
            EditText(
                this
            ).apply {

                hint =
                    "Search chart / procedure name"

                isSingleLine =
                    true

                textSize =
                    15f

                background =
                    null

                setTextColor(
                    primaryTextColor()
                )

                setHintTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    8.dp,
                    0,
                    0,
                    0
                )

                importantForAutofill =
                    View.IMPORTANT_FOR_AUTOFILL_NO

                addTextChangedListener(
                    object :
                        TextWatcher {

                        override fun beforeTextChanged(
                            s: CharSequence?,
                            start: Int,
                            count: Int,
                            after: Int
                        ) = Unit

                        override fun onTextChanged(
                            s: CharSequence?,
                            start: Int,
                            before: Int,
                            count: Int
                        ) {

                            if (
                                selectedCategory.isNotBlank()
                            ) {

                                refreshSelectedCategory()
                            }
                        }

                        override fun afterTextChanged(
                            s: Editable?
                        ) = Unit
                    }
                )
            }

        searchContainer.addView(
            searchBox,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        root.addView(
            searchContainer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                50.dp
            ).apply {

                setMargins(
                    16.dp,
                    2.dp,
                    16.dp,
                    8.dp
                )
            }
        )

        categoryTitle =
            TextView(
                this
            ).apply {

                text =
                    "SELECT A CHART CATEGORY"

                textSize =
                    12f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    18.dp,
                    8.dp,
                    18.dp,
                    8.dp
                )
            }

        listContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    14.dp,
                    6.dp,
                    14.dp,
                    14.dp
                )
            }

        chartScrollView =
            ScrollView(
                this
            ).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                addView(
                    listContainer,
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                )
            }

        categoryContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    8.dp,
                    6.dp,
                    8.dp,
                    6.dp
                )
            }

        val landscape =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_LANDSCAPE


        if (
            landscape
        ) {

            landscapeCategoryScroll =
                ScrollView(
                    this
                ).apply {

                    isVerticalScrollBarEnabled =
                        false

                    overScrollMode =
                        ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                    addView(
                        categoryContainer,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        )
                    )
                }

        } else {

            portraitCategoryScroll =
                HorizontalScrollView(
                    this
                ).apply {

                    isHorizontalScrollBarEnabled =
                        false

                    overScrollMode =
                        HorizontalScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                    addView(
                        categoryContainer,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                }
        }
        if (
            landscape
        ) {

            buildLandscape()

        } else {

            buildPortrait()
        }

        installSearchBarScrollBehavior()

        mountAirportWorkspace()

        showProfileView()

        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { view, insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                0,
                bars.top,
                0,
                bars.bottom
            )

            insets
        }

        ViewCompat.requestApplyInsets(
            root
        )
    }

    private fun installSearchBarScrollBehavior() {

        chartScrollView
            .viewTreeObserver
            .addOnScrollChangedListener {

                val currentY =
                    chartScrollView.scrollY

                if (
                    ignoreSearchBarScroll ||
                    searchBarAnimation
                        ?.isRunning ==
                        true
                ) {

                    lastChartScrollY =
                        currentY

                    return@addOnScrollChangedListener
                }

                val dy =
                    currentY -
                        lastChartScrollY

                lastChartScrollY =
                    currentY

                if (
                    searchBox.hasFocus()
                ) {

                    downwardScrollDistance =
                        0

                    upwardScrollDistance =
                        0

                    if (
                        searchBarHidden
                    ) {

                        setSearchBarVisible(
                            true
                        )
                    }

                    return@addOnScrollChangedListener
                }

                if (
                    currentY <=
                    4.dp
                ) {

                    downwardScrollDistance =
                        0

                    upwardScrollDistance =
                        0

                    if (
                        searchBarHidden
                    ) {

                        setSearchBarVisible(
                            true
                        )
                    }

                    return@addOnScrollChangedListener
                }

                if (
                    dy >
                    0
                ) {

                    downwardScrollDistance +=
                        dy

                    upwardScrollDistance =
                        0

                    if (
                        !searchBarHidden &&
                        currentY >
                            76.dp &&
                        downwardScrollDistance >=
                            18.dp
                    ) {

                        setSearchBarVisible(
                            false
                        )
                    }

                } else if (
                    dy <
                    0
                ) {

                    upwardScrollDistance +=
                        -dy

                    downwardScrollDistance =
                        0

                    if (
                        searchBarHidden &&
                        upwardScrollDistance >=
                            12.dp
                    ) {

                        setSearchBarVisible(
                            true
                        )
                    }
                }
            }

        searchBox
            .setOnFocusChangeListener {
                _,
                hasFocus ->

                if (
                    hasFocus &&
                    searchBarHidden
                ) {

                    setSearchBarVisible(
                        true
                    )
                }
            }
    }


    private fun setSearchBarVisible(
        visible: Boolean
    ) {

        if (
            !::searchContainer.isInitialized ||
            !::chartScrollView.isInitialized
        ) {

            return
        }

        if (
            visible ==
            !searchBarHidden &&
            searchBarAnimation
                ?.isRunning !=
                true
        ) {

            return
        }

        searchBarAnimation
            ?.cancel()

        val params =
            searchContainer
                .layoutParams
                as?
                LinearLayout.LayoutParams
                ?: return

        val fullHeight =
            50.dp

        val fullTopMargin =
            2.dp

        val fullBottomMargin =
            8.dp

        val currentHeight =
            params.height
                .coerceAtLeast(
                    0
                )

        val currentTopMargin =
            params.topMargin
                .coerceAtLeast(
                    0
                )

        val currentBottomMargin =
            params.bottomMargin
                .coerceAtLeast(
                    0
                )

        val targetHeight =
            if (
                visible
            ) {

                fullHeight

            } else {

                0
            }

        val targetTopMargin =
            if (
                visible
            ) {

                fullTopMargin

            } else {

                0
            }

        val targetBottomMargin =
            if (
                visible
            ) {

                fullBottomMargin

            } else {

                0
            }

        val currentTotal =
            currentHeight +
                currentTopMargin +
                currentBottomMargin

        val targetTotal =
            targetHeight +
                targetTopMargin +
                targetBottomMargin

        if (
            currentTotal ==
            targetTotal
        ) {

            searchBarHidden =
                !visible

            searchContainer.alpha =
                if (
                    visible
                ) {

                    1f

                } else {

                    0f
                }

            return
        }

        downwardScrollDistance =
            0

        upwardScrollDistance =
            0

        searchBarHidden =
            !visible

        var previousTotal =
            currentTotal

        searchBarAnimation =
            ValueAnimator
                .ofFloat(
                    0f,
                    1f
                )
                .apply {

                    duration =
                        170L

                    interpolator =
                        android.view.animation
                            .DecelerateInterpolator()

                    addUpdateListener {
                        animator ->

                        val fraction =
                            animator
                                .animatedFraction

                        val newHeight =
                            (
                                currentHeight +
                                    (
                                        targetHeight -
                                            currentHeight
                                        ) *
                                    fraction
                                )
                                .toInt()

                        val newTopMargin =
                            (
                                currentTopMargin +
                                    (
                                        targetTopMargin -
                                            currentTopMargin
                                        ) *
                                    fraction
                                )
                                .toInt()

                        val newBottomMargin =
                            (
                                currentBottomMargin +
                                    (
                                        targetBottomMargin -
                                            currentBottomMargin
                                        ) *
                                    fraction
                                )
                                .toInt()

                        val newTotal =
                            newHeight +
                                newTopMargin +
                                newBottomMargin

                        val delta =
                            newTotal -
                                previousTotal

                        previousTotal =
                            newTotal

                        params.height =
                            newHeight

                        params.topMargin =
                            newTopMargin

                        params.bottomMargin =
                            newBottomMargin

                        searchContainer
                            .layoutParams =
                            params

                        searchContainer.alpha =
                            if (
                                fullHeight >
                                0
                            ) {

                                (
                                    newHeight
                                        .toFloat() /
                                        fullHeight
                                            .toFloat()
                                    )
                                    .coerceIn(
                                        0f,
                                        1f
                                    )

                            } else {

                                if (
                                    visible
                                ) {

                                    1f

                                } else {

                                    0f
                                }
                            }

                        if (
                            delta !=
                            0
                        ) {

                            ignoreSearchBarScroll =
                                true

                            chartScrollView
                                .scrollBy(
                                    0,
                                    delta
                                )

                            chartScrollView
                                .post {

                                    ignoreSearchBarScroll =
                                        false

                                    lastChartScrollY =
                                        chartScrollView
                                            .scrollY
                                }
                        }
                    }
                }

        searchBarAnimation
            ?.start()
    }


    private fun buildPortrait() {

        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            categoryTitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScrollView
            ),
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        root.addView(
            content,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        root.addView(
            portraitCategoryScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                78.dp
            )
        )
    }

    private fun buildLandscape() {

        val workspace =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL
            }

        val categoryPane =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setBackgroundColor(
                    surfaceColor()
                )

                elevation =
                    8.dp.toFloat()
            }

        val categoryHeader =
            TextView(
                this
            ).apply {

                text =
                    "CATEGORIES"

                textSize =
                    11f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    6.dp,
                    8.dp,
                    6.dp,
                    8.dp
                )
            }

        categoryPane.addView(
            categoryHeader,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                36.dp
            )
        )

        categoryPane.addView(
            landscapeCategoryScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        workspace.addView(
            categoryPane,
            LinearLayout.LayoutParams(
                132.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            categoryTitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScrollView
            ),
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        workspace.addView(
            content,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        root.addView(
            workspace,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )
    }

    private fun buildChartScroller(
        scrollView: ScrollView
    ): LinearLayout {

        val wrapper =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        val topIndicator =
            TextView(
                this
            ).apply {

                text =
                    "▲"

                textSize =
                    17f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                alpha =
                    0.25f

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        -450.dp
                    )
                }
            }

        val bottomIndicator =
            TextView(
                this
            ).apply {

                text =
                    "▼"

                textSize =
                    17f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                alpha =
                    0.25f

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        450.dp
                    )
                }
            }

        wrapper.addView(
            topIndicator,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                32.dp
            )
        )

        wrapper.addView(
            scrollView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        wrapper.addView(
            bottomIndicator,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                32.dp
            )
        )

        scrollView
            .viewTreeObserver
            .addOnScrollChangedListener {

                val child =
                    scrollView.getChildAt(
                        0
                    )

                val maxScroll =
                    if (
                        child != null
                    ) {
                        (
                            child.height -
                                scrollView.height
                            ).coerceAtLeast(
                                0
                            )
                    } else {
                        0
                    }

                topIndicator.alpha =
                    if (
                        scrollView.scrollY > 0
                    ) {
                        1f
                    } else {
                        0.25f
                    }

                bottomIndicator.alpha =
                    if (
                        scrollView.scrollY <
                            maxScroll
                    ) {
                        1f
                    } else {
                        0.25f
                    }
            }

        return wrapper
    }

    private fun loadCharts() {

        val charts =
            repository
                .getDisplayChartsForAirport(
                    icao
                )

        categoryContainer
            .removeAllViews()

        listContainer
            .removeAllViews()

        if (
            charts.isEmpty()
        ) {

            categoryTitle.text =
                "NO CHARTS AVAILABLE"

            showNoChartsMessage()

            return
        }

        val categories =
            charts
                .map {
                    ChartRepository
                        .normalizeCategory(
                            it.category
                        )
                }
                .distinct()
                .sortedBy {
                    ChartRepository
                        .categoryOrder(
                            it
                        )
                }

        categories.forEach {
            addCategoryButton(
                it,
                charts.count { item ->
                    ChartRepository
                        .normalizeCategory(
                            item.category
                        ) == it
                }
            )
        }

        val requestedCategory =
            ChartRepository
                .normalizeCategory(
                    selectedCategory
                )

        val firstCategory =
            categories.firstOrNull {
                it == requestedCategory
            }
                ?: categories.firstOrNull()

        if (
            firstCategory != null
        ) {

            selectCategory(
                firstCategory
            )
        }
    }

    private fun addCategoryButton(
        category: String,
        count: Int
    ) {

        val horizontal =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_PORTRAIT

        val button =
            TextView(
                this
            ).apply {

                text =
                    buildCategoryButtonText(
                        category,
                        count
                    )

                textSize =
                    if (
                        horizontal
                    ) {
                        10f
                    } else {
                        11f
                    }

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    8.dp,
                    7.dp,
                    8.dp,
                    7.dp
                )

                minWidth =
                    if (
                        horizontal
                    ) {
                        82.dp
                    } else {
                        106.dp
                    }

                minHeight =
                    if (
                        horizontal
                    ) {
                        54.dp
                    } else {
                        64.dp
                    }

                isClickable =
                    true

                isFocusable =
                    true

                setOnClickListener {

                    selectCategory(
                        category
                    )
                }
            }

        button.background =
            createCategoryBackground(
                category ==
                    selectedCategory
            )

        val params =
            if (
                horizontal
            ) {

                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.MATCH_PARENT
                )

            } else {

                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }

        params.setMargins(
            4.dp,
            3.dp,
            4.dp,
            3.dp
        )

        categoryContainer.addView(
            button,
            params
        )
    }

    private fun buildCategoryButtonText(
        category: String,
        count: Int
    ): String {

        val label =
            ChartRepository
                .displayCategory(
                    category
                )

        return "$label\n$count"
    }

    private fun selectCategory(
        category: String
    ) {

        selectedCategory =
            ChartRepository
                .normalizeCategory(
                    category
                )

        searchBox.hint =
            "Search " +
                ChartRepository
                    .displayCategory(
                        selectedCategory
                    ) +
                " chart / procedure"

        refreshSelectedCategory()

        refreshCategoryButtons()

        chartScrollView.post {

            chartScrollView.fullScroll(
                View.FOCUS_UP
            )
        }
    }

    private fun refreshSelectedCategory() {

        if (
            selectedCategory.isBlank()
        ) {
            return
        }

        val categoryCharts =
            repository
                .getDisplayChartsForAirport(
                    icao
                )
                .filter {
                    ChartRepository
                        .normalizeCategory(
                            it.category
                        ) ==
                        selectedCategory
                }
                .sortedBy {
                    it.page
                }

        val query =
            if (
                ::searchBox.isInitialized
            ) {

                searchBox.text
                    ?.toString()
                    .orEmpty()
                    .trim()

            } else {

                ""
            }

        val charts =
            if (
                query.isBlank()
            ) {

                categoryCharts

            } else {

                categoryCharts.filter {
                    it.name.contains(
                        query,
                        ignoreCase =
                            true
                    )
                }
            }

        categoryTitle.text =
            ChartRepository
                .displayCategory(
                    selectedCategory
                ) +
                if (
                    query.isBlank()
                ) {

                    "  •  " +
                        categoryCharts.size +
                        " CHARTS"

                } else {

                    "  •  " +
                        charts.size +
                        " OF " +
                        categoryCharts.size
                }

        listContainer.removeAllViews()

        if (
            charts.isEmpty()
        ) {

            showNoChartsMessage()

        } else {

            charts.forEach {
                addChartRow(
                    it
                )
            }
        }
    }

    private fun refreshCategoryButtons() {

        for (
            index in 0 until
                categoryContainer.childCount
        ) {

            val child =
                categoryContainer
                    .getChildAt(
                        index
                    )

            if (
                child !is TextView
            ) {
                continue
            }

            val raw =
                child.text
                    .toString()

            val category =
                raw
                    .lineSequence()
                    .firstOrNull()
                    .orEmpty()

            val normalized =
                ChartRepository
                    .normalizeCategory(
                        category
                    )

            child.background =
                createCategoryBackground(
                    normalized ==
                        selectedCategory
                )

            child.setTextColor(
                if (
                    normalized ==
                        selectedCategory
                ) {
                    Color.WHITE
                } else {
                    primaryTextColor()
                }
            )
        }
    }

    private fun addChartRow(
        chart: ChartRepository.ChartInfo
    ) {

        val card =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    18.dp,
                    15.dp,
                    18.dp,
                    15.dp
                )

                background =
                    createChartBackground()

                isClickable =
                    true

                isFocusable =
                    true

                minimumHeight =
                    82.dp

                setOnClickListener {

                    openChart(
                        chart
                    )
                }
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    chart.name

                textSize =
                    16f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    4
            }

        val number =
            TextView(
                this
            ).apply {

                text =
                    if (
                        chart.chartNumber.isNotBlank()
                    ) {

                        "Chart ${chart.chartNumber}"

                    } else {

                        "Chart"
                    }

                textSize =
                    11f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    5.dp,
                    0,
                    0
                )
            }

        val subtitle =
            TextView(
                this
            ).apply {

                text =
                    ChartRepository
                        .displayCategory(
                            chart.category
                        )

                textSize =
                    12f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    3.dp,
                    0,
                    0
                )
            }

        card.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            number,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            subtitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        listContainer.addView(
            card,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                setMargins(
                    2.dp,
                    5.dp,
                    2.dp,
                    5.dp
                )
            }
        )
    }

    private fun openChart(chart: ChartRepository.ChartInfo) {
        showChartInline(chart)
    }

    private fun openChartAdvanced(
        chart: ChartRepository.ChartInfo
    ) {

        val intent =
            Intent(
                this,
                PdfViewerActivity::class.java
            )

        intent.putExtra(
            "PAGE",
            chart.page
        )

        intent.putExtra(
            "TITLE",
            chart.name
        )

        intent.putExtra(
            "ICAO",
            chart.icao
        )

        intent.putExtra(
            "AIRPORT_NAME",
            chart.airportName
        )

        intent.putExtra(
            "CITY",
            chart.city
        )

        intent.putExtra(
            "CATEGORY",
            chart.category
        )

        startActivity(
            intent
        )
    }

    private fun showNoChartsMessage() {

        val box =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    30.dp,
                    70.dp,
                    30.dp,
                    70.dp
                )
            }

        val icon =
            TextView(
                this
            ).apply {

                text =
                    "⊘"

                textSize =
                    42f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "No charts found"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    0,
                    12.dp,
                    0,
                    0
                )
            }

        box.addView(
            icon
        )

        box.addView(
            title
        )

        listContainer.addView(
            box,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
    }

    private fun buildAirportSubtitle():
        String {

        return airportName
            .ifBlank {
                "Airport charts"
            }
    }

    private fun createSearchBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                18.dp.toFloat()

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            colors =
                if (
                    isDarkTheme()
                ) {
                    intArrayOf(
                        Color.argb(
                            242,
                            4,
                            31,
                            68
                        ),
                        Color.argb(
                            246,
                            2,
                            17,
                            40
                        )
                    )
                } else {
                    intArrayOf(
                        Color.rgb(
                            255,
                            255,
                            255
                        ),
                        Color.rgb(
                            232,
                            246,
                            255
                        )
                    )
                }

            setStroke(
                1.dp,
                if (
                    isDarkTheme()
                ) {
                    Color.rgb(
                        0,
                        185,
                        255
                    )
                } else {
                    Color.rgb(
                        82,
                        160,
                        214
                    )
                }
            )
        }
    }


    private fun createChartBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                19.dp.toFloat()

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            colors =
                if (
                    isDarkTheme()
                ) {
                    intArrayOf(
                        Color.argb(
                            246,
                            4,
                            27,
                            58
                        ),
                        Color.argb(
                            248,
                            2,
                            15,
                            36
                        )
                    )
                } else {
                    intArrayOf(
                        Color.rgb(
                            255,
                            255,
                            255
                        ),
                        Color.rgb(
                            235,
                            247,
                            255
                        )
                    )
                }

            setStroke(
                1.dp,
                if (
                    isDarkTheme()
                ) {
                    Color.rgb(
                        0,
                        180,
                        255
                    )
                } else {
                    Color.rgb(
                        89,
                        163,
                        214
                    )
                }
            )
        }
    }


    private fun createCategoryBackground(
        selected: Boolean
    ): GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                14.dp.toFloat()

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            colors =
                if (
                    selected
                ) {
                    intArrayOf(
                        Color.rgb(
                            0,
                            183,
                            255
                        ),
                        Color.rgb(
                            0,
                            91,
                            204
                        )
                    )
                } else if (
                    isDarkTheme()
                ) {
                    intArrayOf(
                        Color.rgb(
                            8,
                            39,
                            70
                        ),
                        Color.rgb(
                            4,
                            26,
                            50
                        )
                    )
                } else {
                    intArrayOf(
                        Color.rgb(
                            250,
                            253,
                            255
                        ),
                        Color.rgb(
                            227,
                            242,
                            252
                        )
                    )
                }

            setStroke(
                1.dp,
                if (
                    selected
                ) {
                    Color.rgb(
                        89,
                        229,
                        255
                    )
                } else if (
                    isDarkTheme()
                ) {
                    Color.rgb(
                        36,
                        135,
                        196
                    )
                } else {
                    Color.rgb(
                        100,
                        169,
                        214
                    )
                }
            )
        }
    }


    private fun pageBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            colors =
                if (
                    isDarkTheme()
                ) {
                    intArrayOf(
                        Color.rgb(
                            0,
                            20,
                            49
                        ),
                        Color.rgb(
                            1,
                            11,
                            28
                        ),
                        Color.rgb(
                            1,
                            7,
                            18
                        )
                    )
                } else {
                    intArrayOf(
                        Color.rgb(
                            225,
                            243,
                            255
                        ),
                        Color.rgb(
                            249,
                            252,
                            255
                        ),
                        Color.rgb(
                            235,
                            247,
                            255
                        )
                    )
                }
        }
    }


    private fun backgroundColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                1,
                10,
                25
            )
        } else {
            Color.rgb(
                239,
                248,
                255
            )
        }
    }


    private fun surfaceColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                5,
                26,
                55
            )
        } else {
            Color.rgb(
                248,
                253,
                255
            )
        }
    }


    private fun primaryTextColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                241,
                245,
                248
            )
        } else {
            Color.rgb(
                18,
                32,
                48
            )
        }
    }

    private fun secondaryTextColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                158,
                174,
                187
            )
        } else {
            Color.rgb(
                91,
                107,
                122
            )
        }
    }

    private fun isDarkTheme():
        Boolean {

        return (
            resources.configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK
        ) ==
            Configuration.UI_MODE_NIGHT_YES
    }

    private val Int.dp: Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
            ).toInt()
}
